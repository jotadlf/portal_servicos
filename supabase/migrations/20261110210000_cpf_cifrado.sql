-- CPF cifrado. A coluna cpf (texto puro) dá lugar a duas:
--   cpf_hash    HMAC-SHA256 do CPF com chave secreta: única, barra CPF repetido sem abrir o CPF.
--               Hash sem chave não serve: há só ~1 bilhão de CPFs válidos, testáveis em minutos.
--   cpf_cifrado pgp_sym_encrypt (AES) do CPF: para quando for preciso ler, como na cobrança.
-- As duas chaves nascem aqui, aleatórias, no Vault do Supabase (guardadas cifradas). Cada banco
-- (local, CI, produção) tem as suas, e nenhuma vai para o repositório. Só as funções do banco as
-- leem. Quem administra o projeto Supabase consegue ler o Vault: isso protege contra cópias e
-- despejos do banco, leitura da tabela no painel e logs, não contra o dono do projeto.

create function interno.chave(nome text) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  valor text;
begin
  select s.decrypted_secret into valor from vault.decrypted_secrets s where s.name = nome;
  if valor is null then
    raise exception 'Chave % não encontrada no Vault', nome;
  end if;
  return valor;
end
$$;

-- Só cria a chave se ainda não existir (permite reaplicar em bancos que já têm)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cpf_hmac') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cpf_hmac',
      'Chave do HMAC do CPF (contas.cpf_hash). Trocar exige recalcular todos os hashes.');
  end if;
  if not exists (select 1 from vault.secrets where name = 'cpf_cifra') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cpf_cifra',
      'Chave da cifra do CPF (contas.cpf_cifrado). Trocar exige decifrar e cifrar de novo.');
  end if;
end
$$;

create function interno.cpf_hash(cpf text) returns text
language sql stable strict set search_path = ''
as $$ select encode(extensions.hmac(cpf, interno.chave('cpf_hmac'), 'sha256'), 'hex') $$;

create function interno.cifrar_cpf(cpf text) returns bytea
language sql volatile strict set search_path = ''
as $$ select extensions.pgp_sym_encrypt(cpf, interno.chave('cpf_cifra'), 'cipher-algo=aes256') $$;

-- Ninguém chama hoje; fica para a cobrança, que precisa do CPF de quem paga
create function interno.decifrar_cpf(cifrado bytea) returns text
language sql stable strict set search_path = ''
as $$ select extensions.pgp_sym_decrypt(cifrado, interno.chave('cpf_cifra')) $$;

-- ---------- colunas novas, com os CPFs que já existem ----------

alter table public.contas
  add column cpf_hash text unique,
  add column cpf_cifrado bytea;

update public.contas
set cpf_hash = interno.cpf_hash(cpf), cpf_cifrado = interno.cifrar_cpf(cpf)
where cpf is not null;

drop trigger cpf_fixo on public.contas;
drop function interno.cpf_fixo();
alter table public.contas drop column cpf;

-- Depois de gravado, o CPF não muda, venha a alteração de onde vier
create function interno.cpf_fixo() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.cpf_hash is not null
     and (new.cpf_hash is distinct from old.cpf_hash or new.cpf_cifrado is distinct from old.cpf_cifrado) then
    perform interno.erro_campo('cpf', 'O CPF não pode ser alterado.');
  end if;
  return new;
end
$$;

create trigger cpf_fixo
  before update of cpf_hash, cpf_cifrado on public.contas
  for each row execute function interno.cpf_fixo();

-- ---------- funções que usavam a coluna cpf ----------

create or replace function public.validar_cadastro(p jsonb default '{}') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
  cadastro record;
  email_informado text;
begin
  perform interno.nome_pessoa(dados);
  email_informado := lower(interno.texto(dados, 'email', 254, 'O e-mail'));
  if email_informado = '' then
    perform interno.erro_campo('email', 'Informe seu e-mail.');
  end if;
  if not interno.email_valido(email_informado) then
    perform interno.erro_campo('email', 'Informe um e-mail válido, como nome@exemplo.com.');
  end if;
  -- Só o tamanho: a senha vai direto para o Supabase Auth
  if jsonb_typeof(dados -> 'passwordLength') is distinct from 'number' or (dados ->> 'passwordLength')::numeric < 6 then
    perform interno.erro_campo('password', 'A senha precisa ter pelo menos 6 caracteres.');
  end if;
  -- Limite do bcrypt, que o Supabase Auth usa (em bytes)
  if (dados ->> 'passwordLength')::numeric > 72 then
    perform interno.erro_campo('password', 'A senha pode ter até 72 caracteres.');
  end if;
  select * into cadastro from interno.dados_cadastro(dados);
  if exists (select 1 from auth.users u where lower(u.email) = email_informado) then
    perform interno.erro_campo('email', 'Já existe uma conta com esse e-mail. Entre com ele ou use outro.', 409);
  end if;
  if cadastro.cpf is not null
     and exists (select 1 from public.contas a where a.cpf_hash = interno.cpf_hash(cadastro.cpf)) then
    perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
  end if;
  perform interno.conferir_aceites(dados);
end
$$;

create or replace function interno.nova_conta() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cadastro record;
  conta public.contas;
begin
  select * into cadastro from interno.dados_cadastro(dados);
  perform interno.conferir_aceites(dados);
  insert into public.contas (
    id, email, nome, cpf_hash, cpf_cifrado, nascimento,
    termos_versao, termos_aceitos_em, privacidade_versao, privacidade_aceita_em
  )
  values (
    new.id, lower(new.email), cadastro.nome, interno.cpf_hash(cadastro.cpf), interno.cifrar_cpf(cadastro.cpf),
    cadastro.nascimento, interno.versao_termos(), now(), interno.versao_privacidade(), now()
  )
  returning * into conta;
  if cadastro.cpf is not null then
    perform interno.criar_prestador(conta);
  end if;
  return new;
end
$$;

create or replace function public.virar_prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  dados jsonb := interno.objeto(p);
  cpf_informado text;
  nascimento_informado date;
begin
  if exists (select 1 from public.prestadores where conta_id = conta.id) then
    return interno.conta_json(conta.id);
  end if;
  -- A administração usa o portal sem plano e não precisa de CPF nem data de nascimento.
  -- Quem já tem CPF gravado não informa de novo: o que vier é ignorado.
  if conta.cpf_hash is null and not conta.admin then
    cpf_informado := interno.so_digitos(interno.texto(dados, 'cpf', 14, 'O CPF'));
    if cpf_informado = '' then
      perform interno.erro_campo('cpf', 'Informe seu CPF.');
    end if;
    if not interno.cpf_valido(cpf_informado) then
      perform interno.erro_campo('cpf', 'Informe um CPF válido.');
    end if;
    nascimento_informado := interno.nascimento(dados);
    if exists (select 1 from public.contas a where a.cpf_hash = interno.cpf_hash(cpf_informado)) then
      perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
    end if;
    update public.contas
    set cpf_hash = interno.cpf_hash(cpf_informado),
        cpf_cifrado = interno.cifrar_cpf(cpf_informado),
        nascimento = nascimento_informado
    where id = conta.id
    returning * into conta;
  end if;
  perform interno.criar_prestador(conta);
  return interno.conta_json(conta.id);
end
$$;

revoke execute on function interno.chave(text) from public, anon, authenticated;
revoke execute on function interno.cpf_hash(text) from public, anon, authenticated;
revoke execute on function interno.cifrar_cpf(text) from public, anon, authenticated;
revoke execute on function interno.decifrar_cpf(bytea) from public, anon, authenticated;
revoke execute on function interno.cpf_fixo() from public, anon, authenticated;
