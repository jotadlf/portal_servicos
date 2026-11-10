-- Data de nascimento de quem oferece serviços: pedida junto com o CPF (no cadastro e no
-- botão "Quero oferecer serviços"), só de maiores de 18 anos e fixa depois de gravada,
-- como o CPF. Não sai do banco. Quem já oferecia serviços antes fica sem a data.

alter table public.contas add column nascimento date;

-- Chega como texto AAAA-MM-DD. Precisa ser uma data que existe, de alguém com 18 a 120 anos.
create function interno.nascimento(p jsonb) returns date
language plpgsql stable set search_path = ''
as $$
declare
  valor text := interno.texto(p, 'birthDate', 10, 'A data de nascimento');
  data date;
  hoje date := interno.hoje();
begin
  if valor = '' then
    perform interno.erro_campo('birthDate', 'Informe sua data de nascimento.');
  end if;
  if valor !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    perform interno.erro_campo('birthDate', 'Informe uma data válida, como 25/03/1990.');
  end if;
  begin
    data := make_date(substr(valor, 1, 4)::integer, substr(valor, 6, 2)::integer, substr(valor, 9, 2)::integer);
  exception when others then
    perform interno.erro_campo('birthDate', 'Informe uma data válida, como 25/03/1990.');
  end;
  if data > hoje or data <= (hoje - interval '120 years')::date then
    perform interno.erro_campo('birthDate', 'Informe uma data válida, como 25/03/1990.');
  end if;
  if data > (hoje - interval '18 years')::date then
    perform interno.erro_campo('birthDate', 'É preciso ter 18 anos ou mais para oferecer serviços.');
  end if;
  return data;
end
$$;

-- O tipo de retorno muda (ganha a data), então a função é recriada
drop function interno.dados_cadastro(jsonb);

create function interno.dados_cadastro(p jsonb) returns table (nome text, cpf text, nascimento date)
language plpgsql set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
begin
  nome := interno.nome_pessoa(dados);
  cpf := null;
  nascimento := null;
  if dados -> 'asProvider' = 'true'::jsonb then
    cpf := interno.so_digitos(interno.texto(dados, 'cpf', 14, 'O CPF'));
    if cpf = '' then
      perform interno.erro_campo('cpf', 'Informe seu CPF.');
    end if;
    if not interno.cpf_valido(cpf) then
      perform interno.erro_campo('cpf', 'Informe um CPF válido.');
    end if;
    nascimento := interno.nascimento(dados);
  end if;
  return next;
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
  insert into public.contas (id, email, nome, cpf, nascimento)
  values (new.id, lower(new.email), cadastro.nome, cadastro.cpf, cadastro.nascimento)
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
  if conta.cpf is null and not conta.admin then
    cpf_informado := interno.so_digitos(interno.texto(dados, 'cpf', 14, 'O CPF'));
    if cpf_informado = '' then
      perform interno.erro_campo('cpf', 'Informe seu CPF.');
    end if;
    if not interno.cpf_valido(cpf_informado) then
      perform interno.erro_campo('cpf', 'Informe um CPF válido.');
    end if;
    nascimento_informado := interno.nascimento(dados);
    if exists (select 1 from public.contas a where a.cpf = cpf_informado) then
      perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
    end if;
    update public.contas set cpf = cpf_informado, nascimento = nascimento_informado
    where id = conta.id
    returning * into conta;
  end if;
  perform interno.criar_prestador(conta);
  return interno.conta_json(conta.id);
end
$$;

-- Depois de gravada, a data de nascimento não muda, venha a alteração de onde vier
create function interno.nascimento_fixo() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.nascimento is not null and new.nascimento is distinct from old.nascimento then
    perform interno.erro_campo('birthDate', 'A data de nascimento não pode ser alterada.');
  end if;
  return new;
end
$$;

create trigger nascimento_fixo
  before update of nascimento on public.contas
  for each row execute function interno.nascimento_fixo();

revoke execute on function interno.nascimento(jsonb) from public, anon, authenticated;
revoke execute on function interno.dados_cadastro(jsonb) from public, anon, authenticated;
revoke execute on function interno.nascimento_fixo() from public, anon, authenticated;
