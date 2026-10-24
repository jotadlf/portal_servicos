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
create table public.contas (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Sempre minúsculo e sem espaços nas pontas
  email text not null,
  nome text not null,
  -- Só dígitos, com DDD
  telefone text not null default '',
  -- Só dígitos; pedido apenas de quem oferece serviços. Nunca sai do banco.
  cpf text unique,
  -- Caminho no bucket "fotos" (ou exemplos/… nas fotos de exemplo, que vêm do próprio app)
  foto text,
  cep text not null default '',
  rua text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  uf text not null default '',
  admin boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.modalidades (
  id text primary key,
  nome text not null,
  -- Serviços sugeridos
  sugestoes text[] not null,
  -- Caminho no bucket "fotos"; as modalidades de fábrica usam a imagem do app
  imagem text,
  posicao integer not null
);

create table public.prestadores (
  id text primary key default 'p-' || gen_random_uuid(),
  -- Prestadores de exemplo não têm conta de login
  conta_id uuid unique references public.contas (id) on delete cascade,
  -- Dados públicos, copiados da conta quando ela é salva
  nome text not null,
  bairro text not null default '',
  whatsapp text not null default '',
  foto text,
  sobre text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  plano text check (plano in ('mensal', 'semestral')),
  forma_pagamento text check (forma_pagamento in ('pix', 'cartao')),
  fim_teste date,
  nota numeric(2, 1) not null default 0,
  total_avaliacoes integer not null default 0,
  criado_em timestamptz not null default now()
);

create table public.servicos (
  id bigint generated always as identity primary key,
  prestador_id text not null references public.prestadores (id) on delete cascade,
  -- Remover a modalidade apaga os serviços dela
  modalidade_id text not null references public.modalidades (id) on delete cascade,
  nome text not null,
  -- Reais inteiros; NULL = a combinar
  preco integer check (preco is null or preco >= 0),
  -- Como o preço é cobrado
  unidade text not null default 'servico' check (unidade in ('diaria', 'm2', 'empreita', 'servico', 'hora')),
  posicao integer not null
);

create index servicos_por_prestador on public.servicos (prestador_id);
create index servicos_por_modalidade on public.servicos (modalidade_id, nome);

create table public.avaliacoes (
  id text primary key default gen_random_uuid()::text,
  prestador_id text not null references public.prestadores (id) on delete cascade,
  autor text not null,
  nota integer not null check (nota between 1 and 5),
  comentario text not null,
  data date not null
);

create index avaliacoes_por_prestador on public.avaliacoes (prestador_id);

create table public.contatos (
  id text primary key default gen_random_uuid()::text,
  prestador_id text not null references public.prestadores (id) on delete cascade,
  cliente text not null,
  servico text not null,
  mensagem text not null default '',
  bairro text not null default '',
  data date not null,
  respondido boolean not null default false
);

create index contatos_por_prestador on public.contatos (prestador_id);

-- Uma linha só, editada na administração
create table public.ajustes_plano (
  id integer primary key check (id = 1),
  preco_mensal numeric(10, 2) not null,
  preco_semestral numeric(10, 2) not null,
  dias_teste integer not null,
  gateway text not null check (gateway in ('mercadopago', 'stripe', 'pagseguro')),
  pix_ativo boolean not null,
  cartao_ativo boolean not null
);

-- Fechadas para a API: só as funções de baixo mexem nelas
alter table public.contas enable row level security;
alter table public.modalidades enable row level security;
alter table public.prestadores enable row level security;
alter table public.servicos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.contatos enable row level security;
alter table public.ajustes_plano enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Valores de fábrica; a administração muda depois
insert into public.ajustes_plano (id, preco_mensal, preco_semestral, dias_teste, gateway, pix_ativo, cartao_ativo)
values (1, 19.90, 99.90, 15, 'mercadopago', true, true)
on conflict (id) do nothing;

insert into public.modalidades (id, nome, sugestoes, posicao) values
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
        and exists (select 1 from public.contas where id = auth.uid() and admin))
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

-- Campos em json (não jsonb): a tela mostra na ordem em que foram listados
create function interno.erro(status integer, mensagem text, campos json default null) returns void
language plpgsql
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = mensagem,
    detail = coalesce(campos, '{}'::json)::text,
    hint = status::text;
end
$$;

-- Erro de validação de um campo: a tela mostra a mensagem embaixo dele
create function interno.erro_campo(campo text, mensagem text, status integer default 400) returns void
language plpgsql
as $$
begin
  perform interno.erro(status, mensagem, json_build_object(campo, mensagem));
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

create function interno.conta_atual() returns public.contas
language plpgsql stable
as $$
declare
  conta public.contas;
begin
  select * into conta from public.contas where id = auth.uid();
  if not found then
    perform interno.erro(401, 'Entre na sua conta para continuar.');
  end if;
  return conta;
end
$$;

create function interno.exigir_admin() returns public.contas
language plpgsql stable
as $$
declare
  conta public.contas := interno.conta_atual();
begin
  if not conta.admin then
    perform interno.erro(403, 'Esta área é só para a administração do portal.');
  end if;
  return conta;
end
$$;

create function interno.prestador_proprio() returns public.prestadores
language plpgsql stable
as $$
declare
  pro public.prestadores;
begin
  perform interno.conta_atual();
  select * into pro from public.prestadores where conta_id = auth.uid();
  if not found then
    perform interno.erro(403, 'Você ainda não oferece serviços.');
  end if;
  return pro;
end
$$;

-- ---------- apoio: respostas em JSON (o mesmo formato da API antiga) ----------

-- O que a própria pessoa vê da conta. CPF nunca sai.
create function interno.conta_json(alvo uuid) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
      'id', a.id,
      'email', a.email,
      'name', a.nome,
      'phone', a.telefone,
      'address', jsonb_build_object(
        'cep', a.cep, 'street', a.rua, 'number', a.numero, 'complement', a.complemento,
        'neighborhood', a.bairro, 'city', a.cidade, 'state', a.uf
      )
    ) || jsonb_strip_nulls(jsonb_build_object(
      'photo', a.foto,
      'professionalId', p.id,
      'isAdmin', case when a.admin then true end
    ))
  from public.contas a
  left join public.prestadores p on p.conta_id = a.id
  where a.id = alvo
$$;

-- Sem login: só o primeiro nome, sem foto, preços nem WhatsApp. Esses dados nem saem do banco.
create function interno.prestador_json(pro public.prestadores, completo boolean) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
      'id', pro.id,
      'name', case when completo then pro.nome else split_part(pro.nome, ' ', 1) end,
      'services', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'professionId', s.modalidade_id,
            'name', s.nome,
            'price', case when completo then s.preco end,
            -- A unidade não é sigilosa: aparece mesmo com o preço escondido
            'unit', s.unidade
          ) || case when not completo and s.preco is not null then '{"hidden": true}'::jsonb else '{}'::jsonb end
          order by s.posicao, s.id
        )
        from public.servicos s
        where s.prestador_id = pro.id
      ), '[]'::jsonb),
      'status', pro.status,
      'rating', pro.nota,
      'reviews', pro.total_avaliacoes,
      'neighborhood', pro.bairro
    ) || jsonb_strip_nulls(jsonb_build_object(
      'photo', case when completo then pro.foto end,
      'trialEndsAt', pro.fim_teste,
      'plan', pro.plano,
      'about', nullif(pro.sobre, ''),
      'whatsapp', case when completo then nullif(pro.whatsapp, '') end
    ))
$$;

create function interno.plano_json() returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'monthlyPrice', preco_mensal::float8,
    'semiannualPrice', preco_semestral::float8,
    'trialDays', dias_teste,
    'gateway', gateway,
    'pixEnabled', pix_ativo,
    'cardEnabled', cartao_ativo
  )
  from public.ajustes_plano
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
  if cadastro.cpf is not null and exists (select 1 from public.contas a where a.cpf = cadastro.cpf) then
    perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
  end if;
end
$$;

-- Cria o perfil de prestador (rascunho) com os dados públicos da conta
create function interno.criar_prestador(conta public.contas) returns void
language sql
as $$
  insert into public.prestadores (conta_id, nome, bairro, whatsapp, foto)
  values (conta.id, conta.nome, conta.bairro, conta.telefone, conta.foto)
$$;

-- Conta nova no Supabase Auth: cria o perfil com os dados que vieram no signUp.
-- Confere tudo de novo: quem chama o signUp direto não escapa das regras.
create function interno.nova_conta() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cadastro record;
  conta public.contas;
begin
  select * into cadastro from interno.dados_cadastro(dados);
  insert into public.contas (id, email, nome, cpf)
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
  conta public.contas := interno.conta_atual();
begin
  return interno.conta_json(conta.id);
end
$$;

create function public.salvar_conta(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  dados jsonb := interno.objeto(p);
  endereco jsonb := coalesce(dados -> 'address', '{}'::jsonb);
  -- Prefixo "novo_" para não confundir com as colunas de mesmo nome
  novo_nome text := interno.nome_pessoa(dados);
  novo_telefone text;
  novo_cep text;
  nova_rua text;
  novo_numero text;
  novo_complemento text;
  novo_bairro text;
  nova_cidade text;
  nova_uf text;
begin
  novo_telefone := interno.so_digitos(interno.texto(dados, 'phone', 20, 'O WhatsApp'));
  if novo_telefone <> '' and not interno.telefone_valido(novo_telefone) then
    perform interno.erro_campo('phone', 'Informe o WhatsApp com DDD, por exemplo (62) 99999-9999.');
  end if;

  if endereco = 'null'::jsonb then
    endereco := '{}'::jsonb;
  end if;
  if jsonb_typeof(endereco) <> 'object' then
    perform interno.erro_campo('address', 'Endereço em formato inválido.');
  end if;
  novo_cep := interno.so_digitos(interno.texto(endereco, 'cep', 9, 'O CEP'));
  if novo_cep <> '' and char_length(novo_cep) <> 8 then
    perform interno.erro_campo('cep', 'Complete os 8 números do CEP.');
  end if;
  nova_rua := interno.texto(endereco, 'street', 80, 'A rua');
  novo_numero := interno.texto(endereco, 'number', 20, 'O número');
  novo_complemento := interno.texto(endereco, 'complement', 60, 'O complemento');
  novo_bairro := interno.texto(endereco, 'neighborhood', 50, 'O bairro');
  nova_cidade := interno.colapsar(interno.texto(endereco, 'city', 50, 'A cidade'));
  if nova_cidade <> '' and not interno.nome_valido(nova_cidade) then
    perform interno.erro_campo('city', 'Use só letras no nome da cidade.');
  end if;
  nova_uf := upper(interno.texto(endereco, 'state', 2, 'A UF'));
  if nova_uf <> '' and not interno.uf_valida(nova_uf) then
    perform interno.erro_campo('state', 'UF inválida.');
  end if;

  -- A foto é enviada antes (definir_foto); aqui só confere que existe
  if conta.foto is null and exists (select 1 from public.prestadores where conta_id = conta.id) then
    perform interno.erro_campo('photo', 'Adicione uma foto: ela aparece no seu perfil de prestador.');
  end if;

  update public.contas
  set nome = novo_nome, telefone = novo_telefone, cep = novo_cep, rua = nova_rua, numero = novo_numero,
      complemento = novo_complemento, bairro = novo_bairro, cidade = nova_cidade, uf = nova_uf
  where id = conta.id;
  -- O perfil público usa os dados da conta; do endereço, só o bairro aparece
  update public.prestadores
  set nome = novo_nome, whatsapp = novo_telefone, bairro = novo_bairro
  where conta_id = conta.id;
  return interno.conta_json(conta.id);
end
$$;

-- A foto já foi enviada ao Storage, na pasta da conta; aqui ela passa a ser a da conta
create function public.definir_foto(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  caminho text := interno.texto(interno.objeto(p), 'path', 200, 'A foto');
begin
  if (storage.foldername(caminho))[1] is distinct from conta.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = caminho) then
    perform interno.erro_campo('photo', 'Escolha um arquivo de imagem, como JPG ou PNG.');
  end if;
  update public.contas set foto = caminho where id = conta.id;
  update public.prestadores set foto = caminho where conta_id = conta.id;
  return interno.conta_json(conta.id);
end
$$;

-- Qualquer pessoa pode passar a oferecer serviços a qualquer momento
create function public.virar_prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
begin
  if not exists (select 1 from public.prestadores where conta_id = conta.id) then
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
                     order by (pro.nota * pro.total_avaliacoes + 4 * 10) / (pro.total_avaliacoes + 10) desc, pro.id)
    from public.prestadores pro
    where pro.status = 'publicado'
      and exists (
        select 1 from public.servicos s
        where s.prestador_id = pro.id
          and s.modalidade_id = coalesce(dados ->> 'profissao', '')
          and s.nome = coalesce(dados ->> 'servico', '')
      )
  ), '[]'::jsonb);
end
$$;

create function public.prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.prestadores;
begin
  select * into pro from public.prestadores where id = interno.objeto(p) ->> 'id';
  -- Rascunho só aparece para o próprio prestador
  if not found or (pro.status <> 'publicado' and pro.conta_id is distinct from auth.uid()) then
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
      'id', r.id, 'professionalId', r.prestador_id, 'author', r.autor,
      'rating', r.nota, 'comment', r.comentario, 'date', r.data
    ) order by r.data desc, r.id)
    from public.avaliacoes r
    join public.prestadores pro on pro.id = r.prestador_id
    where r.prestador_id = interno.objeto(p) ->> 'id' and pro.status = 'publicado'
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
  pro public.prestadores := interno.prestador_proprio();
  lista jsonb := interno.objeto(p) -> 'services';
  item jsonb;
  profissao text;
  -- Sufixo "_item" para não confundir com as colunas de mesmo nome
  nome_item text;
  chave text;
  preco_item jsonb;
  unidade_item text;
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
    if not exists (select 1 from public.modalidades where id = profissao) then
      perform interno.erro_campo('professionId', 'Escolha uma profissão do catálogo.');
    end if;
    nome_item := interno.colapsar(interno.texto(item, 'name', 60, 'O nome do serviço'));
    if nome_item = '' then
      perform interno.erro_campo('name', 'Informe o nome do serviço.');
    end if;
    chave := profissao || '|' || interno.normalizar(nome_item);
    if chave = any (vistos) then
      perform interno.erro_campo('name', 'Você já tem um serviço com esse nome nesta profissão.');
    end if;
    vistos := vistos || chave;

    preco_item := coalesce(item -> 'price', 'null'::jsonb);
    if preco_item <> 'null'::jsonb and (
      jsonb_typeof(preco_item) <> 'number'
      or preco_item::text::numeric <> trunc(preco_item::text::numeric)
      or preco_item::text::numeric < 0
      or preco_item::text::numeric > 999999
    ) then
      perform interno.erro_campo('price', 'Informe o preço em reais inteiros, até 999999.');
    end if;

    -- Sem unidade (clientes antigos): por serviço
    unidade_item := coalesce(item ->> 'unit', 'servico');
    if unidade_item not in ('diaria', 'm2', 'empreita', 'servico', 'hora') then
      perform interno.erro_campo('unit', 'Escolha como o preço é cobrado.');
    end if;

    profissoes := profissoes || profissao;
    nomes := nomes || nome_item;
    precos := precos || case when preco_item = 'null'::jsonb then null else preco_item::text::numeric::integer end;
    unidades := unidades || unidade_item;
  end loop;

  delete from public.servicos where prestador_id = pro.id;
  insert into public.servicos (prestador_id, modalidade_id, nome, preco, unidade, posicao)
  select pro.id, s.profissao, s.nome_item, s.preco_item, s.unidade_item, s.ordem - 1
  from unnest(profissoes, nomes, precos, unidades) with ordinality as s (profissao, nome_item, preco_item, unidade_item, ordem);
  return interno.prestador_json(pro, true);
end
$$;

create function public.salvar_sobre(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.prestadores := interno.prestador_proprio();
  novo_sobre text := interno.texto(interno.objeto(p), 'about', 300, 'O texto');
begin
  update public.prestadores set sobre = novo_sobre where id = pro.id;
  return jsonb_build_object('about', novo_sobre);
end
$$;

create function public.publicar(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  pro public.prestadores := interno.prestador_proprio();
  dados jsonb := interno.objeto(p);
  campos text[] := '{}';
  faltando text[] := '{}';
  ajustes public.ajustes_plano;
  plano_escolhido text := dados ->> 'plan';
  forma text := dados ->> 'method';
  novo_fim_teste date;
begin
  if pro.status = 'publicado' then
    perform interno.erro(409, 'Seu perfil já está publicado.');
  end if;

  -- Os mesmos requisitos do cartão "Publicar", conferidos aqui
  if pro.foto is null then
    campos := campos || 'photo'::text;
    faltando := faltando || 'Adicione uma foto no Perfil.'::text;
  end if;
  if pro.whatsapp = '' then
    campos := campos || 'phone'::text;
    faltando := faltando || 'Cadastre seu WhatsApp no Perfil.'::text;
  end if;
  if not exists (select 1 from public.servicos where prestador_id = pro.id) then
    campos := campos || 'services'::text;
    faltando := faltando || 'Cadastre pelo menos um serviço.'::text;
  end if;
  if cardinality(campos) > 0 then
    perform interno.erro(400, 'Falta completar o perfil antes de publicar.', json_object(campos, faltando));
  end if;

  -- A administração usa o portal inteiro sem contratar plano: publica sem plano nem pagamento
  if conta.admin then
    update public.prestadores
    set status = 'publicado', plano = null, forma_pagamento = null, fim_teste = null
    where id = pro.id;
    return jsonb_build_object('status', 'publicado');
  end if;

  select * into ajustes from public.ajustes_plano where id = 1;
  if jsonb_typeof(dados -> 'plan') is distinct from 'string' or plano_escolhido not in ('mensal', 'semestral') then
    perform interno.erro_campo('plan', 'Escolha um plano.');
  end if;
  if jsonb_typeof(dados -> 'method') is distinct from 'string'
     or not ((forma = 'pix' and ajustes.pix_ativo) or (forma = 'cartao' and ajustes.cartao_ativo)) then
    perform interno.erro_campo('method', 'Escolha uma forma de pagamento disponível.');
  end if;

  -- TODO: criar a assinatura no gateway antes de publicar
  novo_fim_teste := interno.hoje() + ajustes.dias_teste;
  update public.prestadores
  set status = 'publicado', plano = plano_escolhido, forma_pagamento = forma, fim_teste = novo_fim_teste
  where id = pro.id;
  return jsonb_build_object('status', 'publicado', 'plan', plano_escolhido, 'trialEndsAt', novo_fim_teste);
end
$$;

create function public.meus_contatos(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.prestadores := interno.prestador_proprio();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'professionalId', c.prestador_id, 'client', c.cliente, 'task', c.servico,
      'message', c.mensagem, 'neighborhood', c.bairro, 'date', c.data, 'answered', c.respondido
    ) order by c.data desc, c.id)
    from public.contatos c
    where c.prestador_id = pro.id
  ), '[]'::jsonb);
end
$$;

create function public.marcar_respondido(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pro public.prestadores := interno.prestador_proprio();
begin
  -- Só marca contatos do próprio prestador
  update public.contatos set respondido = true
  where id = interno.objeto(p) ->> 'id' and prestador_id = pro.id;
  if not found then
    perform interno.erro(404, 'Contato não encontrado.');
  end if;
  return jsonb_build_object('answered', true);
end
$$;

-- ---------- catálogo ----------

create function interno.modalidade_json(m public.modalidades) returns jsonb
language sql stable
as $$
  select jsonb_build_object('id', m.id, 'name', m.nome, 'tasks', to_jsonb(m.sugestoes))
    || jsonb_strip_nulls(jsonb_build_object('image', m.imagem))
$$;

create function public.catalogo(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(interno.modalidade_json(m) order by m.posicao)
    from public.modalidades m
  ), '[]'::jsonb);
end
$$;

create function public.adicionar_modalidade(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  dados jsonb := interno.objeto(p);
  -- Prefixo "novo_" para não confundir com as colunas de mesmo nome
  novo_nome text;
  novas_sugestoes text[];
  nova_imagem text;
  base text;
  novo_id text;
  n integer := 2;
  modalidade public.modalidades;
begin
  perform interno.exigir_admin();
  novo_nome := interno.colapsar(interno.texto(dados, 'name', 40, 'O nome'));
  if novo_nome = '' then
    perform interno.erro_campo('name', 'Informe o nome da modalidade.');
  end if;
  if not interno.nome_valido(novo_nome) then
    perform interno.erro_campo('name', 'Use só letras no nome da modalidade, sem números ou símbolos.');
  end if;
  if exists (select 1 from public.modalidades m where interno.normalizar(m.nome) = interno.normalizar(novo_nome)) then
    perform interno.erro_campo('name', 'Já existe uma modalidade com esse nome.', 409);
  end if;

  if jsonb_typeof(dados -> 'tasks') is distinct from 'array' then
    perform interno.erro_campo('tasks', 'Informe pelo menos um serviço, para a modalidade aparecer na busca.');
  end if;
  select coalesce(array_agg(t.servico order by t.ordem), '{}')
  into novas_sugestoes
  from (
    select interno.colapsar(regexp_replace(value #>> '{}', '^\s+|\s+$', '', 'g')) as servico, ordem
    from jsonb_array_elements(dados -> 'tasks') with ordinality as e (value, ordem)
    where jsonb_typeof(value) = 'string'
  ) t
  where t.servico <> '';
  if cardinality(novas_sugestoes) = 0 then
    perform interno.erro_campo('tasks', 'Informe pelo menos um serviço, para a modalidade aparecer na busca.');
  end if;
  if cardinality(novas_sugestoes) > 30 then
    perform interno.erro_campo('tasks', 'Informe até 30 serviços.');
  end if;
  if exists (select 1 from unnest(novas_sugestoes) s where char_length(s) > 60) then
    perform interno.erro_campo('tasks', 'Cada serviço pode ter até 60 caracteres.');
  end if;

  -- A imagem já foi enviada ao Storage, em modalidades/
  nova_imagem := nullif(interno.texto(dados, 'image', 200, 'A imagem'), '');
  if nova_imagem is not null and (
    (storage.foldername(nova_imagem))[1] is distinct from 'modalidades'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = nova_imagem)
  ) then
    perform interno.erro_campo('image', 'Escolha um arquivo de imagem, como JPG ou PNG.');
  end if;

  base := coalesce(nullif(trim(both '-' from regexp_replace(interno.normalizar(novo_nome), '[^a-z0-9]+', '-', 'g')), ''), 'modalidade');
  novo_id := base;
  while exists (select 1 from public.modalidades where id = novo_id) loop
    novo_id := base || '-' || n;
    n := n + 1;
  end loop;

  insert into public.modalidades (id, nome, sugestoes, imagem, posicao)
  values (novo_id, novo_nome, novas_sugestoes, nova_imagem, (select coalesce(max(posicao), -1) + 1 from public.modalidades))
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
  delete from public.modalidades where id = interno.objeto(p) ->> 'id';
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

  update public.ajustes_plano
  set preco_mensal = mensal, preco_semestral = semestral, dias_teste = dias::integer,
      gateway = dados ->> 'gateway', pix_ativo = pix, cartao_ativo = cartao
  where id = 1;
  return interno.plano_json();
end
$$;

-- ---------- administração ----------

create function public.estatisticas(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  ajustes public.ajustes_plano;
  total_contas integer;
  total_prestadores integer;
  total_publicados integer;
  total_em_teste integer;
  total_pagantes integer;
  receita float8;
begin
  perform interno.exigir_admin();
  select * into ajustes from public.ajustes_plano where id = 1;

  select count(*) into total_contas from public.contas where not admin;
  select count(*) into total_prestadores from public.prestadores;

  -- Perfil da administração é publicado sem plano: não está em teste, não paga nem entra na receita
  with cobrados as (
    select pro.plano, pro.fim_teste > interno.hoje() as em_teste
    from public.prestadores pro
    left join public.contas a on a.id = pro.conta_id
    where pro.status = 'publicado' and not coalesce(a.admin, false)
  )
  select
    (select count(*) from public.prestadores where status = 'publicado'),
    count(*) filter (where em_teste),
    count(*) filter (where not coalesce(em_teste, false)),
    -- Receita mensal recorrente: planos semestrais entram pelo valor equivalente por mês
    coalesce(sum(case when plano = 'semestral' then ajustes.preco_semestral::float8 / 6
                      else ajustes.preco_mensal::float8 end)
             filter (where not coalesce(em_teste, false)), 0)
  into total_publicados, total_em_teste, total_pagantes, receita
  from cobrados;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'accounts', total_contas,
      -- Prestadores de exemplo não têm conta de login; contam como cadastrados
      'people', total_contas + (select count(*) from public.prestadores where conta_id is null),
      'consumersOnly', (
        select count(*) from public.contas a
        where not a.admin and not exists (select 1 from public.prestadores pro where pro.conta_id = a.id)
      ),
      'providers', total_prestadores,
      'published', total_publicados,
      'drafts', total_prestadores - total_publicados,
      'inTrial', total_em_teste,
      'paying', total_pagantes,
      'services', (select count(*) from public.servicos),
      'modalities', (select count(*) from public.modalidades),
      'contacts', (select count(*) from public.contatos),
      'reviews', (select count(*) from public.avaliacoes),
      'monthlyRevenue', receita
    ),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'professionId', r.id, 'name', r.nome, 'services', r.total_servicos, 'providers', r.total_prestadores
      ) order by r.total_servicos desc, r.posicao)
      from (
        select m.id, m.nome, m.posicao, count(s.id) as total_servicos, count(distinct s.prestador_id) as total_prestadores
        from public.modalidades m
        left join public.servicos s on s.modalidade_id = m.id
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
