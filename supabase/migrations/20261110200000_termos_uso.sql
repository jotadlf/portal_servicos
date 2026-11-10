-- Termos de uso e política de privacidade: o cadastro só cria a conta de quem aceitou as versões
-- atuais dos dois, e a conta guarda quando e qual versão de cada um foi aceita. Contas criadas
-- antes ficam sem o aceite. Ao mudar um dos textos, mude a versão aqui e em src/lib/controlador.ts.

alter table public.contas
  add column termos_versao text,
  add column termos_aceitos_em timestamptz,
  add column privacidade_versao text,
  add column privacidade_aceita_em timestamptz;

create function interno.versao_termos() returns text
language sql immutable set search_path = ''
as $$ select '2026-11-10' $$;

create function interno.versao_privacidade() returns text
language sql immutable set search_path = ''
as $$ select '2026-11-10' $$;

-- O cadastro manda as versões que a pessoa leu e aceitou; precisam ser as atuais
create function interno.conferir_aceites(p jsonb) returns void
language plpgsql stable set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
begin
  if dados ->> 'termsVersion' is distinct from interno.versao_termos() then
    perform interno.erro_campo('terms', 'Para criar a conta, aceite os termos de uso.');
  end if;
  if dados ->> 'privacyVersion' is distinct from interno.versao_privacidade() then
    perform interno.erro_campo('privacy', 'Para criar a conta, aceite a política de privacidade.');
  end if;
end
$$;

-- Igual à versão anterior, com os aceites conferidos por último (os outros campos aparecem antes)
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
  if cadastro.cpf is not null and exists (select 1 from public.contas a where a.cpf = cadastro.cpf) then
    perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
  end if;
  perform interno.conferir_aceites(dados);
end
$$;

-- Quem chama o signUp direto também precisa ter aceitado os dois
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
    id, email, nome, cpf, nascimento,
    termos_versao, termos_aceitos_em, privacidade_versao, privacidade_aceita_em
  )
  values (
    new.id, lower(new.email), cadastro.nome, cadastro.cpf, cadastro.nascimento,
    interno.versao_termos(), now(), interno.versao_privacidade(), now()
  )
  returning * into conta;
  if cadastro.cpf is not null then
    perform interno.criar_prestador(conta);
  end if;
  return new;
end
$$;

revoke execute on function interno.versao_termos() from public, anon, authenticated;
revoke execute on function interno.versao_privacidade() from public, anon, authenticated;
revoke execute on function interno.conferir_aceites(jsonb) from public, anon, authenticated;
