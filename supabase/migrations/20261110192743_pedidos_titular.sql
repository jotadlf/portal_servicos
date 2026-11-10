-- Canal do titular (LGPD arts. 18 e 19): quem tem conta pede acesso, correção ou exclusão dos
-- próprios dados pelo app, e a administração vê os pedidos e marca como respondidos.
-- A resposta em si vai por e-mail. Apagar a conta apaga os pedidos dela.

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas (id) on delete cascade,
  assunto text not null check (assunto in ('acesso', 'correcao', 'exclusao', 'duvida', 'outro')),
  mensagem text not null check (char_length(mensagem) between 1 and 1000),
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);

create index pedidos_conta_idx on public.pedidos (conta_id);

-- Como as demais tabelas: nada direto pela API, só pelas funções abaixo
alter table public.pedidos enable row level security;
revoke all on public.pedidos from anon, authenticated;

-- Quantos pedidos sem resposta uma conta pode ter ao mesmo tempo
create function interno.limite_pedidos_abertos() returns integer
language sql immutable set search_path = ''
as $$ select 5 $$;

create function interno.pedido_json(pedido public.pedidos) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
      'id', pedido.id,
      'subject', pedido.assunto,
      'message', pedido.mensagem,
      'createdAt', pedido.criado_em
    ) || jsonb_strip_nulls(jsonb_build_object('answeredAt', pedido.respondido_em))
$$;

create function public.enviar_pedido(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  dados jsonb := interno.objeto(p);
  -- Prefixo "novo_"/"nova_" para não confundir com as colunas de mesmo nome
  novo_assunto text := interno.texto(dados, 'subject', 20, 'O assunto');
  nova_mensagem text := interno.texto(dados, 'message', 1000, 'A mensagem');
  pedido public.pedidos;
begin
  if novo_assunto not in ('acesso', 'correcao', 'exclusao', 'duvida', 'outro') then
    perform interno.erro_campo('subject', 'Escolha o assunto.');
  end if;
  if nova_mensagem = '' then
    perform interno.erro_campo('message', 'Escreva o seu pedido.');
  end if;
  if (select count(*) from public.pedidos where conta_id = conta.id and respondido_em is null)
      >= interno.limite_pedidos_abertos() then
    perform interno.erro(429, format(
      'Você já tem %s pedidos esperando resposta. Aguarde a resposta antes de enviar outro.',
      interno.limite_pedidos_abertos()
    ));
  end if;
  insert into public.pedidos (conta_id, assunto, mensagem)
  values (conta.id, novo_assunto, nova_mensagem)
  returning * into pedido;
  return interno.pedido_json(pedido);
end
$$;

-- Os pedidos da própria pessoa, do mais novo ao mais antigo
create function public.meus_pedidos(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
begin
  return coalesce((
    select jsonb_agg(interno.pedido_json(pe) order by pe.criado_em desc, pe.id)
    from public.pedidos pe
    where pe.conta_id = conta.id
  ), '[]'::jsonb);
end
$$;

-- Administração: todos os pedidos, os sem resposta primeiro, com nome e e-mail para responder
create function public.pedidos_admin(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform interno.exigir_admin();
  return coalesce((
    select jsonb_agg(
      interno.pedido_json(pe) || jsonb_build_object('name', a.nome, 'email', a.email)
      order by pe.respondido_em is not null, pe.criado_em, pe.id
    )
    from public.pedidos pe
    join public.contas a on a.id = pe.conta_id
  ), '[]'::jsonb);
end
$$;

create function public.marcar_pedido_respondido(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pedido public.pedidos;
begin
  perform interno.exigir_admin();
  update public.pedidos set respondido_em = coalesce(respondido_em, now())
  where id::text = interno.objeto(p) ->> 'id'
  returning * into pedido;
  if not found then
    perform interno.erro(404, 'Pedido não encontrado.');
  end if;
  return interno.pedido_json(pedido);
end
$$;

revoke execute on function interno.limite_pedidos_abertos() from public, anon, authenticated;
revoke execute on function interno.pedido_json(public.pedidos) from public, anon, authenticated;

revoke execute on function public.enviar_pedido(jsonb) from public, anon;
revoke execute on function public.meus_pedidos(jsonb) from public, anon;
revoke execute on function public.pedidos_admin(jsonb) from public, anon;
revoke execute on function public.marcar_pedido_respondido(jsonb) from public, anon;
grant execute on function public.enviar_pedido(jsonb) to authenticated;
grant execute on function public.meus_pedidos(jsonb) to authenticated;
grant execute on function public.pedidos_admin(jsonb) to authenticated;
grant execute on function public.marcar_pedido_respondido(jsonb) to authenticated;
