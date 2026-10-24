-- Banco do Portal de Serviços no Supabase. Substitui a API local (frontend/server, SQLite).
--
-- Ninguém lê nem grava as tabelas direto: a RLS fica ligada sem nenhuma política, e o app
-- só chama as funções RPC de baixo (security definer). Cada uma confere sessão, permissão e
-- dados, como as rotas da API antiga: quem chama o Supabase direto não passa por cima das regras.
--
-- Erros: `interno.erro` levanta P0001 com a mensagem em português, o status HTTP equivalente
-- no HINT e as mensagens por campo (JSON) no DETAIL. O app (src/lib/api.ts) transforma isso
-- de volta em ApiError.

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Funções de apoio, fora do schema exposto pela API
create schema if not exists interno;
revoke all on schema interno from public, anon, authenticated;

-- ---------- tabelas ----------

-- Dados da conta; o login (e-mail e senha) fica no Supabase Auth
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Sempre minúsculo e sem espaços nas pontas
  email text not null,
  name text not null,
  -- Só dígitos, com DDD
  phone text not null default '',
  -- Só dígitos; pedido apenas de quem oferece serviços. Nunca sai do banco.
  cpf text unique,
  -- Caminho no bucket "fotos" (ou exemplos/… nas fotos de exemplo, que vêm do próprio app)
  photo text,
  cep text not null default '',
  street text not null default '',
  number text not null default '',
  complement text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  state text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.professions (
  id text primary key,
  name text not null,
  -- Serviços sugeridos
  tasks text[] not null,
  -- Caminho no bucket "fotos"; as modalidades de fábrica usam a imagem do app
  image text,
  position integer not null
);

create table public.professionals (
  id text primary key default 'p-' || gen_random_uuid(),
  -- Prestadores de exemplo não têm conta de login
  account_id uuid unique references public.profiles (id) on delete cascade,
  -- Dados públicos, copiados da conta quando ela é salva
  name text not null,
  neighborhood text not null default '',
  whatsapp text not null default '',
  photo text,
  about text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  plan text check (plan in ('mensal', 'semestral')),
  payment_method text check (payment_method in ('pix', 'cartao')),
  trial_ends_at date,
  rating numeric(2, 1) not null default 0,
  reviews integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.services (
  id bigint generated always as identity primary key,
  professional_id text not null references public.professionals (id) on delete cascade,
  -- Remover a modalidade apaga os serviços dela
  profession_id text not null references public.professions (id) on delete cascade,
  name text not null,
  -- Reais inteiros; NULL = a combinar
  price integer check (price is null or price >= 0),
  -- Como o preço é cobrado
  unit text not null default 'servico' check (unit in ('diaria', 'm2', 'empreita', 'servico', 'hora')),
  position integer not null
);

create index services_by_professional on public.services (professional_id);
create index services_by_task on public.services (profession_id, name);

create table public.reviews (
  id text primary key default gen_random_uuid()::text,
  professional_id text not null references public.professionals (id) on delete cascade,
  author text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  date date not null
);

create index reviews_by_professional on public.reviews (professional_id);

create table public.contacts (
  id text primary key default gen_random_uuid()::text,
  professional_id text not null references public.professionals (id) on delete cascade,
  client text not null,
  task text not null,
  message text not null default '',
  neighborhood text not null default '',
  date date not null,
  answered boolean not null default false
);

create index contacts_by_professional on public.contacts (professional_id);

-- Uma linha só, editada na administração
create table public.plan_settings (
  id integer primary key check (id = 1),
  monthly_price numeric(10, 2) not null,
  semiannual_price numeric(10, 2) not null,
  trial_days integer not null,
  gateway text not null check (gateway in ('mercadopago', 'stripe', 'pagseguro')),
  pix_enabled boolean not null,
  card_enabled boolean not null
);

-- Fechadas para a API: só as funções de baixo mexem nelas
alter table public.profiles enable row level security;
alter table public.professions enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.reviews enable row level security;
alter table public.contacts enable row level security;
alter table public.plan_settings enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Valores de fábrica; a administração muda depois
insert into public.plan_settings (id, monthly_price, semiannual_price, trial_days, gateway, pix_enabled, card_enabled)
values (1, 19.90, 99.90, 15, 'mercadopago', true, true)
on conflict (id) do nothing;

insert into public.professions (id, name, tasks, position) values
  ('eletricista', 'Eletricista', array['Instalar chuveiro', 'Trocar tomada ou interruptor', 'Revisar quadro de energia'], 0),
  ('faxineira', 'Faxineira', array['Faxina completa', 'Limpeza pós-obra', 'Limpeza de vidros'], 1),
  ('diarista', 'Diarista', array['Diária de limpeza', 'Passar roupa', 'Organizar armários'], 2),
  ('encanador', 'Encanador', array['Consertar vazamento', 'Trocar torneira', 'Desentupir pia ou ralo'], 3),
  ('pedreiro', 'Pedreiro', array['Assentar piso', 'Rebocar parede', 'Pequena reforma'], 4),
  ('pintor', 'Pintor', array['Pintar cômodo', 'Pintar portão', 'Aplicar textura'], 5),
  ('montador', 'Montador', array['Montar guarda-roupa', 'Instalar painel de TV', 'Montar cozinha'], 6),
  ('jardineiro', 'Jardineiro', array['Podar árvores', 'Plantar grama', 'Limpar lote'], 7),
  ('chaveiro', 'Chaveiro', array['Abrir porta', 'Trocar fechadura', 'Fazer cópia de chave'], 8)
on conflict (id) do nothing;

-- ---------- fotos (Storage) ----------

-- Público para leitura: os caminhos têm um uuid e só saem do banco para quem entrou na conta.
-- SVG fica de fora: pode carregar script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Cada conta grava só na própria pasta (<id da conta>/…); a administração também em modalidades/
create function interno.pode_gravar_foto(caminho text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select (storage.foldername(caminho))[1] = auth.uid()::text
    or ((storage.foldername(caminho))[1] = 'modalidades'
        and exists (select 1 from public.profiles where id = auth.uid() and is_admin))
$$;

grant usage on schema interno to authenticated;
grant execute on function interno.pode_gravar_foto(text) to authenticated;

create policy "fotos: enviar na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and interno.pode_gravar_foto(name));

create policy "fotos: ver as próprias" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and interno.pode_gravar_foto(name));

create policy "fotos: apagar as próprias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and interno.pode_gravar_foto(name));

-- ---------- apoio: erros e leitura dos dados recebidos ----------

create function interno.erro(status integer, mensagem text, campos jsonb default null) returns void
language plpgsql
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = mensagem,
    detail = coalesce(campos, '{}'::jsonb)::text,
    hint = status::text;
end
$$;

-- Erro de validação de um campo: a tela mostra a mensagem embaixo dele
create function interno.erro_campo(campo text, mensagem text, status integer default 400) returns void
language plpgsql
as $$
begin
  perform interno.erro(status, mensagem, jsonb_build_object(campo, mensagem));
end
$$;

-- O corpo da chamada precisa ser um objeto JSON
create function interno.objeto(p jsonb) returns jsonb
language plpgsql
as $$
begin
  if p is null or p = 'null'::jsonb then
    return '{}'::jsonb;
  end if;
  if jsonb_typeof(p) <> 'object' then
    perform interno.erro(400, 'Dados em formato inválido.');
  end if;
  return p;
end
$$;

-- Texto opcional: devolve aparado; recusa outro tipo e tamanho acima do limite
create function interno.texto(p jsonb, campo text, maximo integer, rotulo text) returns text
language plpgsql
as $$
declare
  valor jsonb := p -> campo;
  aparado text;
begin
  if valor is null or valor = 'null'::jsonb then
    return '';
  end if;
  if jsonb_typeof(valor) <> 'string' then
    perform interno.erro_campo(campo, rotulo || ' em formato inválido.');
  end if;
  aparado := regexp_replace(valor #>> '{}', '^\s+|\s+$', '', 'g');
  if char_length(aparado) > maximo then
    perform interno.erro_campo(campo, format('%s pode ter até %s caracteres.', rotulo, maximo));
  end if;
  return aparado;
end
$$;

create function interno.so_digitos(valor text) returns text
language sql immutable
as $$ select regexp_replace(valor, '\D', '', 'g') $$;

create function interno.colapsar(valor text) returns text
language sql immutable
as $$ select regexp_replace(valor, '\s+', ' ', 'g') $$;

-- Sem diferenciar maiúsculas nem acentos ("eletrica" = "Elétrica")
create function interno.normalizar(valor text) returns text
language sql stable
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, valor)) $$;

-- Mesmas regras de src/lib (nome.ts, cpf.ts, whatsapp.ts, email.ts, cep.ts)

-- Letras (com acento), separadas por espaço, apóstrofo ou hífen
create function interno.nome_valido(valor text) returns boolean
language sql immutable
as $$ select valor ~ '^[A-Za-zÀ-ÖØ-öø-ɏ]+([ ''’-][A-Za-zÀ-ÖØ-öø-ɏ]+)*$' $$;

create function interno.email_valido(valor text) returns boolean
language sql immutable
as $$ select char_length(valor) <= 254 and valor ~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$' $$;

create function interno.telefone_valido(valor text) returns boolean
language sql immutable
as $$ select valor ~ '^[1-9][0-9]{9,10}$' $$;

create function interno.uf_valida(valor text) returns boolean
language sql immutable
as $$
  select valor = any (array['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
    'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'])
$$;

-- Confere os dois dígitos verificadores; todos os dígitos iguais não vale
create function interno.cpf_valido(d text) returns boolean
language plpgsql immutable
as $$
declare
  soma integer;
  resto integer;
  tamanho integer;
begin
  if d !~ '^[0-9]{11}$' or d ~ '^(.)\1{10}$' then
    return false;
  end if;
  foreach tamanho in array array[9, 10] loop
    soma := 0;
    for i in 1..tamanho loop
      soma := soma + substr(d, i, 1)::integer * (tamanho + 2 - i);
    end loop;
    resto := (soma * 10) % 11;
    if resto = 10 then
      resto := 0;
    end if;
    if resto <> substr(d, tamanho + 1, 1)::integer then
      return false;
    end if;
  end loop;
  return true;
end
$$;

create function interno.nome_pessoa(p jsonb, campo text default 'name') returns text
language plpgsql
as $$
declare
  nome text := interno.colapsar(interno.texto(p, campo, 60, 'O nome'));
begin
  if nome = '' then
    perform interno.erro_campo(campo, 'Informe seu nome.');
  end if;
  if not interno.nome_valido(nome) then
    perform interno.erro_campo(campo, 'Use só letras no nome, sem números ou símbolos.');
  end if;
  return nome;
end
$$;

-- Hoje no fuso do portal (o servidor do banco roda em UTC)
create function interno.hoje() returns date
language sql stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- ---------- apoio: quem está chamando ----------

create function interno.conta_atual() returns public.profiles
language plpgsql stable
as $$
declare
  conta public.profiles;
begin
  select * into conta from public.profiles where id = auth.uid();
  if not found then
    perform interno.erro(401, 'Entre na sua conta para continuar.');
  end if;
  return conta;
end
$$;

create function interno.exigir_admin() returns public.profiles
language plpgsql stable
as $$
declare
  conta public.profiles := interno.conta_atual();
begin
  if not conta.is_admin then
    perform interno.erro(403, 'Esta área é só para a administração do portal.');
  end if;
  return conta;
end
$$;

create function interno.prestador_proprio() returns public.professionals
language plpgsql stable
as $$
declare
  pro public.professionals;
begin
  perform interno.conta_atual();
  select * into pro from public.professionals where account_id = auth.uid();
  if not found then
    perform interno.erro(403, 'Você ainda não oferece serviços.');
  end if;
  return pro;
end
$$;

-- ---------- apoio: respostas em JSON (o mesmo formato da API antiga) ----------

-- O que a própria pessoa vê da conta. CPF nunca sai.
create function interno.conta_json(conta_id uuid) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
      'id', a.id,
      'email', a.email,
      'name', a.name,
      'phone', a.phone,
      'address', jsonb_build_object(
        'cep', a.cep, 'street', a.street, 'number', a.number, 'complement', a.complement,
        'neighborhood', a.neighborhood, 'city', a.city, 'state', a.state
      )
    ) || jsonb_strip_nulls(jsonb_build_object(
      'photo', a.photo,
      'professionalId', p.id,
      'isAdmin', case when a.is_admin then true end
    ))
  from public.profiles a
  left join public.professionals p on p.account_id = a.id
  where a.id = conta_id
$$;

-- Sem login: só o primeiro nome, sem foto, preços nem WhatsApp. Esses dados nem saem do banco.
create function interno.prestador_json(pro public.professionals, completo boolean) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
      'id', pro.id,
      'name', case when completo then pro.name else split_part(pro.name, ' ', 1) end,
      'services', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'professionId', s.profession_id,
            'name', s.name,
            'price', case when completo then s.price end,
            -- A unidade não é sigilosa: aparece mesmo com o preço escondido
            'unit', s.unit
          ) || case when not completo and s.price is not null then '{"hidden": true}'::jsonb else '{}'::jsonb end
          order by s.position, s.id
        )
        from public.services s
        where s.professional_id = pro.id
      ), '[]'::jsonb),
      'status', pro.status,
      'rating', pro.rating,
      'reviews', pro.reviews,
      'neighborhood', pro.neighborhood
    ) || jsonb_strip_nulls(jsonb_build_object(
      'photo', case when completo then pro.photo end,
      'trialEndsAt', pro.trial_ends_at,
      'plan', pro.plan,
      'about', nullif(pro.about, ''),
      'whatsapp', case when completo then nullif(pro.whatsapp, '') end
    ))
$$;

create function interno.plano_json() returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'monthlyPrice', monthly_price::float8,
    'semiannualPrice', semiannual_price::float8,
    'trialDays', trial_days,
    'gateway', gateway,
    'pixEnabled', pix_enabled,
    'cardEnabled', card_enabled
  )
  from public.plan_settings
  where id = 1
$$;

-- ---------- contas ----------

-- Dados do cadastro, conferidos antes de criar o login e de novo quando a conta nasce
create function interno.dados_cadastro(p jsonb) returns table (nome text, cpf text)
language plpgsql
as $$
declare
  dados jsonb := interno.objeto(p);
begin
  nome := interno.nome_pessoa(dados);
  cpf := null;
  if dados -> 'asProvider' = 'true'::jsonb then
    cpf := interno.so_digitos(interno.texto(dados, 'cpf', 14, 'O CPF'));
    if cpf = '' then
      perform interno.erro_campo('cpf', 'Informe seu CPF.');
    end if;
    if not interno.cpf_valido(cpf) then
      perform interno.erro_campo('cpf', 'Informe um CPF válido.');
    end if;
  end if;
  return next;
end
$$;

-- Chamada pela tela antes do signUp, para mostrar o problema embaixo do campo certo
create function public.validar_cadastro(p jsonb default '{}') returns void
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
  if cadastro.cpf is not null and exists (select 1 from public.profiles a where a.cpf = cadastro.cpf) then
    perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
  end if;
end
$$;

-- Cria o perfil de prestador (rascunho) com os dados públicos da conta
create function interno.criar_prestador(conta public.profiles) returns void
language sql
as $$
  insert into public.professionals (account_id, name, neighborhood, whatsapp, photo)
  values (conta.id, conta.name, conta.neighborhood, conta.phone, conta.photo)
$$;

-- Conta nova no Supabase Auth: cria o perfil com os dados que vieram no signUp.
-- Confere tudo de novo: quem chama o signUp direto não escapa das regras.
create function interno.nova_conta() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cadastro record;
  conta public.profiles;
begin
  select * into cadastro from interno.dados_cadastro(dados);
  insert into public.profiles (id, email, name, cpf)
  values (new.id, lower(new.email), cadastro.nome, cadastro.cpf)
  returning * into conta;
  if cadastro.cpf is not null then
    perform interno.criar_prestador(conta);
  end if;
  return new;
end
$$;

create trigger nova_conta
  after insert on auth.users
  for each row execute function interno.nova_conta();

create function public.minha_conta(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.profiles := interno.conta_atual();
begin
  return interno.conta_json(conta.id);
end
$$;

create function public.salvar_conta(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.profiles := interno.conta_atual();
  dados jsonb := interno.objeto(p);
  endereco jsonb := coalesce(dados -> 'address', '{}'::jsonb);
  nome text := interno.nome_pessoa(dados);
  telefone text;
  codigo_postal text;
  rua text;
  numero text;
  complemento text;
  bairro text;
  cidade text;
  uf text;
begin
  telefone := interno.so_digitos(interno.texto(dados, 'phone', 20, 'O WhatsApp'));
  if telefone <> '' and not interno.telefone_valido(telefone) then
    perform interno.erro_campo('phone', 'Informe o WhatsApp com DDD, por exemplo (62) 99999-9999.');
  end if;

  if endereco = 'null'::jsonb then
    endereco := '{}'::jsonb;
  end if;
  if jsonb_typeof(endereco) <> 'object' then
    perform interno.erro_campo('address', 'Endereço em formato inválido.');
  end if;
  codigo_postal := interno.so_digitos(interno.texto(endereco, 'cep', 9, 'O CEP'));
  if codigo_postal <> '' and char_length(codigo_postal) <> 8 then
    perform interno.erro_campo('cep', 'Complete os 8 números do CEP.');
  end if;
  rua := interno.texto(endereco, 'street', 80, 'A rua');
  numero := interno.texto(endereco, 'number', 20, 'O número');
  complemento := interno.texto(endereco, 'complement', 60, 'O complemento');
  bairro := interno.texto(endereco, 'neighborhood', 50, 'O bairro');
  cidade := interno.colapsar(interno.texto(endereco, 'city', 50, 'A cidade'));
  if cidade <> '' and not interno.nome_valido(cidade) then
    perform interno.erro_campo('city', 'Use só letras no nome da cidade.');
  end if;
  uf := upper(interno.texto(endereco, 'state', 2, 'A UF'));
  if uf <> '' and not interno.uf_valida(uf) then
    perform interno.erro_campo('state', 'UF inválida.');
  end if;

  -- A foto é enviada antes (definir_foto); aqui só confere que existe
  if conta.photo is null and exists (select 1 from public.professionals where account_id = conta.id) then
    perform interno.erro_campo('photo', 'Adicione uma foto: ela aparece no seu perfil de prestador.');
  end if;

  update public.profiles
  set name = nome, phone = telefone, cep = codigo_postal, street = rua, number = numero,
      complement = complemento, neighborhood = bairro, city = cidade, state = uf
  where id = conta.id;
  -- O perfil público usa os dados da conta; do endereço, só o bairro aparece
  update public.professionals
  set name = nome, whatsapp = telefone, neighborhood = bairro
  where account_id = conta.id;
  return interno.conta_json(conta.id);
end
$$;

-- A foto já foi enviada ao Storage, na pasta da conta; aqui ela passa a ser a da conta
create function public.definir_foto(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.profiles := interno.conta_atual();
  caminho text := interno.texto(interno.objeto(p), 'path', 200, 'A foto');
begin
  if (storage.foldername(caminho))[1] is distinct from conta.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = caminho) then
    perform interno.erro_campo('photo', 'Escolha um arquivo de imagem, como JPG ou PNG.');
  end if;
  update public.profiles set photo = caminho where id = conta.id;
  update public.professionals set photo = caminho where account_id = conta.id;
  return interno.conta_json(conta.id);
end
$$;

-- Qualquer pessoa pode passar a oferecer serviços a qualquer momento
create function public.virar_prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.profiles := interno.conta_atual();
begin
  if not exists (select 1 from public.professionals where account_id = conta.id) then
    perform interno.criar_prestador(conta);
  end if;
  return interno.conta_json(conta.id);
end
$$;

-- ---------- prestadores ----------

-- Publicados que fazem o serviço, da melhor reputação para a pior. Média bayesiana:
-- poucas avaliações puxam a nota para 4, para que 5,0 com 3 avaliações não passe
-- na frente de 4,9 com 132.
create function public.prestadores(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
begin
  return coalesce((
    select jsonb_agg(interno.prestador_json(pro, auth.uid() is not null)
                     order by (pro.rating * pro.reviews + 4 * 10) / (pro.reviews + 10) desc, pro.id)
    from public.professionals pro
    where pro.status = 'publicado'
      and exists (
        select 1 from public.services s
        where s.professional_id = pro.id
          and s.profession_id = coalesce(dados ->> 'profissao', '')
          and s.name = coalesce(dados ->> 'servico', '')
      )
  ), '[]'::jsonb);
end
$$;

create function public.prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.professionals;
begin
  select * into pro from public.professionals where id = interno.objeto(p) ->> 'id';
  -- Rascunho só aparece para o próprio prestador
  if not found or (pro.status <> 'publicado' and pro.account_id is distinct from auth.uid()) then
    perform interno.erro(404, 'Não encontramos este prestador.');
  end if;
  return interno.prestador_json(pro, auth.uid() is not null);
end
$$;

create function public.avaliacoes(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'professionalId', r.professional_id, 'author', r.author,
      'rating', r.rating, 'comment', r.comment, 'date', r.date
    ) order by r.date desc, r.id)
    from public.reviews r
    join public.professionals pro on pro.id = r.professional_id
    where r.professional_id = interno.objeto(p) ->> 'id' and pro.status = 'publicado'
  ), '[]'::jsonb);
end
$$;

create function public.meu_prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  return interno.prestador_json(interno.prestador_proprio(), true);
end
$$;

create function public.salvar_servicos(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.professionals := interno.prestador_proprio();
  lista jsonb := interno.objeto(p) -> 'services';
  item jsonb;
  profissao text;
  nome text;
  chave text;
  preco jsonb;
  unidade text;
  vistos text[] := '{}';
  profissoes text[] := '{}';
  nomes text[] := '{}';
  precos integer[] := '{}';
  unidades text[] := '{}';
begin
  if lista is null or jsonb_typeof(lista) <> 'array' then
    perform interno.erro_campo('services', 'Lista de serviços em formato inválido.');
  end if;
  if jsonb_array_length(lista) > 100 then
    perform interno.erro_campo('services', 'Cadastre até 100 serviços.');
  end if;

  for item in select value from jsonb_array_elements(lista) loop
    if jsonb_typeof(item) <> 'object' then
      item := '{}'::jsonb;
    end if;
    profissao := case when jsonb_typeof(item -> 'professionId') = 'string' then item ->> 'professionId' else '' end;
    if not exists (select 1 from public.professions where id = profissao) then
      perform interno.erro_campo('professionId', 'Escolha uma profissão do catálogo.');
    end if;
    nome := interno.colapsar(interno.texto(item, 'name', 60, 'O nome do serviço'));
    if nome = '' then
      perform interno.erro_campo('name', 'Informe o nome do serviço.');
    end if;
    chave := profissao || '|' || interno.normalizar(nome);
    if chave = any (vistos) then
      perform interno.erro_campo('name', 'Você já tem um serviço com esse nome nesta profissão.');
    end if;
    vistos := vistos || chave;

    preco := coalesce(item -> 'price', 'null'::jsonb);
    if preco <> 'null'::jsonb and (
      jsonb_typeof(preco) <> 'number'
      or preco::text::numeric <> trunc(preco::text::numeric)
      or preco::text::numeric < 0
      or preco::text::numeric > 999999
    ) then
      perform interno.erro_campo('price', 'Informe o preço em reais inteiros, até 999999.');
    end if;

    -- Sem unidade (clientes antigos): por serviço
    unidade := coalesce(item ->> 'unit', 'servico');
    if unidade not in ('diaria', 'm2', 'empreita', 'servico', 'hora') then
      perform interno.erro_campo('unit', 'Escolha como o preço é cobrado.');
    end if;

    profissoes := profissoes || profissao;
    nomes := nomes || nome;
    precos := precos || case when preco = 'null'::jsonb then null else preco::text::numeric::integer end;
    unidades := unidades || unidade;
  end loop;

  delete from public.services where professional_id = pro.id;
  insert into public.services (professional_id, profession_id, name, price, unit, position)
  select pro.id, s.profissao, s.nome, s.preco, s.unidade, s.ordem - 1
  from unnest(profissoes, nomes, precos, unidades) with ordinality as s (profissao, nome, preco, unidade, ordem);
  return interno.prestador_json(pro, true);
end
$$;

create function public.salvar_sobre(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.professionals := interno.prestador_proprio();
  sobre text := interno.texto(interno.objeto(p), 'about', 300, 'O texto');
begin
  update public.professionals set about = sobre where id = pro.id;
  return jsonb_build_object('about', sobre);
end
$$;

create function public.publicar(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.profiles := interno.conta_atual();
  pro public.professionals := interno.prestador_proprio();
  dados jsonb := interno.objeto(p);
  faltando jsonb := '{}'::jsonb;
  ajustes public.plan_settings;
  plano text := dados ->> 'plan';
  forma text := dados ->> 'method';
  fim_teste date;
begin
  if pro.status = 'publicado' then
    perform interno.erro(409, 'Seu perfil já está publicado.');
  end if;

  -- Os mesmos requisitos do cartão "Publicar", conferidos aqui
  if pro.photo is null then
    faltando := faltando || '{"photo": "Adicione uma foto no Perfil."}';
  end if;
  if pro.whatsapp = '' then
    faltando := faltando || '{"phone": "Cadastre seu WhatsApp no Perfil."}';
  end if;
  if not exists (select 1 from public.services where professional_id = pro.id) then
    faltando := faltando || '{"services": "Cadastre pelo menos um serviço."}';
  end if;
  if faltando <> '{}'::jsonb then
    perform interno.erro(400, 'Falta completar o perfil antes de publicar.', faltando);
  end if;

  -- A administração usa o portal inteiro sem contratar plano: publica sem plano nem pagamento
  if conta.is_admin then
    update public.professionals
    set status = 'publicado', plan = null, payment_method = null, trial_ends_at = null
    where id = pro.id;
    return jsonb_build_object('status', 'publicado');
  end if;

  select * into ajustes from public.plan_settings where id = 1;
  if jsonb_typeof(dados -> 'plan') is distinct from 'string' or plano not in ('mensal', 'semestral') then
    perform interno.erro_campo('plan', 'Escolha um plano.');
  end if;
  if jsonb_typeof(dados -> 'method') is distinct from 'string'
     or not ((forma = 'pix' and ajustes.pix_enabled) or (forma = 'cartao' and ajustes.card_enabled)) then
    perform interno.erro_campo('method', 'Escolha uma forma de pagamento disponível.');
  end if;

  -- TODO: criar a assinatura no gateway antes de publicar
  fim_teste := interno.hoje() + ajustes.trial_days;
  update public.professionals
  set status = 'publicado', plan = plano, payment_method = forma, trial_ends_at = fim_teste
  where id = pro.id;
  return jsonb_build_object('status', 'publicado', 'plan', plano, 'trialEndsAt', fim_teste);
end
$$;

create function public.meus_contatos(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.professionals := interno.prestador_proprio();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'professionalId', c.professional_id, 'client', c.client, 'task', c.task,
      'message', c.message, 'neighborhood', c.neighborhood, 'date', c.date, 'answered', c.answered
    ) order by c.date desc, c.id)
    from public.contacts c
    where c.professional_id = pro.id
  ), '[]'::jsonb);
end
$$;

create function public.marcar_respondido(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.professionals := interno.prestador_proprio();
begin
  -- Só marca contatos do próprio prestador
  update public.contacts set answered = true
  where id = interno.objeto(p) ->> 'id' and professional_id = pro.id;
  if not found then
    perform interno.erro(404, 'Contato não encontrado.');
  end if;
  return jsonb_build_object('answered', true);
end
$$;

-- ---------- catálogo ----------

create function interno.modalidade_json(m public.professions) returns jsonb
language sql stable
as $$
  select jsonb_build_object('id', m.id, 'name', m.name, 'tasks', to_jsonb(m.tasks))
    || jsonb_strip_nulls(jsonb_build_object('image', m.image))
$$;

create function public.catalogo(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(interno.modalidade_json(m) order by m.position)
    from public.professions m
  ), '[]'::jsonb);
end
$$;

create function public.adicionar_modalidade(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
  nome text;
  servicos text[];
  imagem text;
  base text;
  novo_id text;
  n integer := 2;
  modalidade public.professions;
begin
  perform interno.exigir_admin();
  nome := interno.colapsar(interno.texto(dados, 'name', 40, 'O nome'));
  if nome = '' then
    perform interno.erro_campo('name', 'Informe o nome da modalidade.');
  end if;
  if not interno.nome_valido(nome) then
    perform interno.erro_campo('name', 'Use só letras no nome da modalidade, sem números ou símbolos.');
  end if;
  if exists (select 1 from public.professions where interno.normalizar(name) = interno.normalizar(nome)) then
    perform interno.erro_campo('name', 'Já existe uma modalidade com esse nome.', 409);
  end if;

  if jsonb_typeof(dados -> 'tasks') is distinct from 'array' then
    perform interno.erro_campo('tasks', 'Informe pelo menos um serviço, para a modalidade aparecer na busca.');
  end if;
  select coalesce(array_agg(t.servico order by t.ordem), '{}')
  into servicos
  from (
    select interno.colapsar(regexp_replace(value #>> '{}', '^\s+|\s+$', '', 'g')) as servico, ordem
    from jsonb_array_elements(dados -> 'tasks') with ordinality as e (value, ordem)
    where jsonb_typeof(value) = 'string'
  ) t
  where t.servico <> '';
  if cardinality(servicos) = 0 then
    perform interno.erro_campo('tasks', 'Informe pelo menos um serviço, para a modalidade aparecer na busca.');
  end if;
  if cardinality(servicos) > 30 then
    perform interno.erro_campo('tasks', 'Informe até 30 serviços.');
  end if;
  if exists (select 1 from unnest(servicos) s where char_length(s) > 60) then
    perform interno.erro_campo('tasks', 'Cada serviço pode ter até 60 caracteres.');
  end if;

  -- A imagem já foi enviada ao Storage, em modalidades/
  imagem := nullif(interno.texto(dados, 'image', 200, 'A imagem'), '');
  if imagem is not null and (
    (storage.foldername(imagem))[1] is distinct from 'modalidades'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = imagem)
  ) then
    perform interno.erro_campo('image', 'Escolha um arquivo de imagem, como JPG ou PNG.');
  end if;

  base := coalesce(nullif(trim(both '-' from regexp_replace(interno.normalizar(nome), '[^a-z0-9]+', '-', 'g')), ''), 'modalidade');
  novo_id := base;
  while exists (select 1 from public.professions where id = novo_id) loop
    novo_id := base || '-' || n;
    n := n + 1;
  end loop;

  insert into public.professions (id, name, tasks, image, position)
  values (novo_id, nome, servicos, imagem, (select coalesce(max(position), -1) + 1 from public.professions))
  returning * into modalidade;
  return interno.modalidade_json(modalidade);
end
$$;

-- Os serviços da modalidade saem junto (ON DELETE CASCADE)
create function public.remover_modalidade(p jsonb default '{}') returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform interno.exigir_admin();
  delete from public.professions where id = interno.objeto(p) ->> 'id';
  if not found then
    perform interno.erro(404, 'Modalidade não encontrada.');
  end if;
end
$$;

-- ---------- plano ----------

create function public.plano(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  return interno.plano_json();
end
$$;

create function interno.preco_plano(dados jsonb, campo text) returns numeric
language plpgsql
as $$
declare
  valor numeric;
begin
  if jsonb_typeof(dados -> campo) is distinct from 'number' then
    perform interno.erro_campo(campo, 'Informe os preços em reais, por exemplo 19,90.');
  end if;
  valor := (dados -> campo)::text::numeric;
  if valor <= 0 or valor > 10000 then
    perform interno.erro_campo(campo, 'Informe os preços em reais, por exemplo 19,90.');
  end if;
  return round(valor, 2);
end
$$;

create function public.salvar_plano(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
  mensal numeric;
  semestral numeric;
  dias numeric;
  pix boolean := dados -> 'pixEnabled' = 'true'::jsonb;
  cartao boolean := dados -> 'cardEnabled' = 'true'::jsonb;
begin
  perform interno.exigir_admin();
  mensal := interno.preco_plano(dados, 'monthlyPrice');
  semestral := interno.preco_plano(dados, 'semiannualPrice');
  if jsonb_typeof(dados -> 'trialDays') is distinct from 'number' then
    perform interno.erro_campo('trialDays', 'O período grátis precisa ser de 0 a 90 dias.');
  end if;
  dias := (dados -> 'trialDays')::text::numeric;
  if dias <> trunc(dias) or dias < 0 or dias > 90 then
    perform interno.erro_campo('trialDays', 'O período grátis precisa ser de 0 a 90 dias.');
  end if;
  if jsonb_typeof(dados -> 'gateway') is distinct from 'string'
     or dados ->> 'gateway' not in ('mercadopago', 'stripe', 'pagseguro') then
    perform interno.erro_campo('gateway', 'Escolha um gateway da lista.');
  end if;
  if not pix and not cartao then
    perform interno.erro_campo('methods', 'Deixe pelo menos uma forma de pagamento ligada.');
  end if;

  update public.plan_settings
  set monthly_price = mensal, semiannual_price = semestral, trial_days = dias::integer,
      gateway = dados ->> 'gateway', pix_enabled = pix, card_enabled = cartao
  where id = 1;
  return interno.plano_json();
end
$$;

-- ---------- administração ----------

create function public.estatisticas(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  ajustes public.plan_settings;
  total_contas integer;
  total_prestadores integer;
  total_publicados integer;
  total_em_teste integer;
  total_pagantes integer;
  receita float8;
begin
  perform interno.exigir_admin();
  select * into ajustes from public.plan_settings where id = 1;

  select count(*) into total_contas from public.profiles where not is_admin;
  select count(*) into total_prestadores from public.professionals;

  -- Perfil da administração é publicado sem plano: não está em teste, não paga nem entra na receita
  with cobrados as (
    select pro.plan, pro.trial_ends_at > interno.hoje() as em_teste
    from public.professionals pro
    left join public.profiles a on a.id = pro.account_id
    where pro.status = 'publicado' and not coalesce(a.is_admin, false)
  )
  select
    (select count(*) from public.professionals where status = 'publicado'),
    count(*) filter (where em_teste),
    count(*) filter (where not coalesce(em_teste, false)),
    -- Receita mensal recorrente: planos semestrais entram pelo valor equivalente por mês
    coalesce(sum(case when plan = 'semestral' then ajustes.semiannual_price::float8 / 6
                      else ajustes.monthly_price::float8 end)
             filter (where not coalesce(em_teste, false)), 0)
  into total_publicados, total_em_teste, total_pagantes, receita
  from cobrados;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'accounts', total_contas,
      -- Prestadores de exemplo não têm conta de login; contam como cadastrados
      'people', total_contas + (select count(*) from public.professionals where account_id is null),
      'consumersOnly', (
        select count(*) from public.profiles a
        where not a.is_admin and not exists (select 1 from public.professionals pro where pro.account_id = a.id)
      ),
      'providers', total_prestadores,
      'published', total_publicados,
      'drafts', total_prestadores - total_publicados,
      'inTrial', total_em_teste,
      'paying', total_pagantes,
      'services', (select count(*) from public.services),
      'modalities', (select count(*) from public.professions),
      'contacts', (select count(*) from public.contacts),
      'reviews', (select count(*) from public.reviews),
      'monthlyRevenue', receita
    ),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'professionId', r.id, 'name', r.name, 'services', r.servicos, 'providers', r.prestadores
      ) order by r.servicos desc, r.position)
      from (
        select m.id, m.name, m.position, count(s.id) as servicos, count(distinct s.professional_id) as prestadores
        from public.professions m
        left join public.services s on s.profession_id = m.id
        group by m.id
      ) r
    ), '[]'::jsonb)
  );
end
$$;

-- As funções de apoio não são chamadas pela API
revoke execute on all functions in schema interno from public, anon, authenticated;
grant execute on function interno.pode_gravar_foto(text) to authenticated;

-- A API do app: só estas funções, chamadas por qualquer um (cada uma confere quem chama)
grant execute on function public.validar_cadastro(jsonb) to anon, authenticated;
grant execute on function public.minha_conta(jsonb) to anon, authenticated;
grant execute on function public.salvar_conta(jsonb) to anon, authenticated;
grant execute on function public.definir_foto(jsonb) to anon, authenticated;
grant execute on function public.virar_prestador(jsonb) to anon, authenticated;
grant execute on function public.prestadores(jsonb) to anon, authenticated;
grant execute on function public.prestador(jsonb) to anon, authenticated;
grant execute on function public.avaliacoes(jsonb) to anon, authenticated;
grant execute on function public.meu_prestador(jsonb) to anon, authenticated;
grant execute on function public.salvar_servicos(jsonb) to anon, authenticated;
grant execute on function public.salvar_sobre(jsonb) to anon, authenticated;
grant execute on function public.publicar(jsonb) to anon, authenticated;
grant execute on function public.meus_contatos(jsonb) to anon, authenticated;
grant execute on function public.marcar_respondido(jsonb) to anon, authenticated;
grant execute on function public.catalogo(jsonb) to anon, authenticated;
grant execute on function public.adicionar_modalidade(jsonb) to anon, authenticated;
grant execute on function public.remover_modalidade(jsonb) to anon, authenticated;
grant execute on function public.plano(jsonb) to anon, authenticated;
grant execute on function public.salvar_plano(jsonb) to anon, authenticated;
grant execute on function public.estatisticas(jsonb) to anon, authenticated;
