-- Contatos e avaliações de verdade. Tocar em "Falar no WhatsApp" grava o contato na aba
-- "Contatos" do prestador, e só quem já falou com o prestador pode avaliá-lo (uma avaliação
-- por pessoa, que ela pode refazer). Apagar a conta do cliente apaga os contatos e as
-- avaliações dele, e a nota do prestador volta a ser calculada sem elas.

alter table public.contatos
  add column cliente_id uuid references public.contas (id) on delete cascade;
create index contatos_por_cliente on public.contatos (cliente_id, prestador_id);

alter table public.avaliacoes
  add column cliente_id uuid references public.contas (id) on delete cascade;
alter table public.avaliacoes
  add constraint uma_avaliacao_por_cliente unique (prestador_id, cliente_id);

-- Soma das notas, para a média não acumular arredondamento. Os dados de exemplo trazem nota e
-- total prontos (132 avaliações, mas só algumas escritas), então a soma parte deles.
alter table public.prestadores add column soma_notas numeric not null default 0;
update public.prestadores set soma_notas = nota * total_avaliacoes;

-- Só as avaliações feitas no app (com cliente_id) mexem na nota; as de exemplo já estão nela
create function interno.contar_avaliacao() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.cliente_id is not null then
    update public.prestadores
    set soma_notas = soma_notas - old.nota, total_avaliacoes = total_avaliacoes - 1
    where id = old.prestador_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.cliente_id is not null then
    update public.prestadores
    set soma_notas = soma_notas + new.nota, total_avaliacoes = total_avaliacoes + 1
    where id = new.prestador_id;
  end if;
  update public.prestadores
  set nota = case when total_avaliacoes > 0 then round(soma_notas / total_avaliacoes, 1) else 0 end
  where id in (old.prestador_id, new.prestador_id)
    and (old.cliente_id is not null or new.cliente_id is not null);
  return null;
end
$$;

create trigger contar_avaliacao
after insert or update or delete on public.avaliacoes
for each row execute function interno.contar_avaliacao();

create function interno.avaliacao_json(r public.avaliacoes) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'professionalId', r.prestador_id, 'author', r.autor,
    'rating', r.nota, 'comment', r.comentario, 'date', r.data
  )
$$;

-- Só prestador publicado recebe contato e avaliação
create function interno.prestador_publicado(dados jsonb) returns public.prestadores
language plpgsql stable set search_path = ''
as $$
declare
  pro public.prestadores;
begin
  select * into pro from public.prestadores where id = dados ->> 'id' and status = 'publicado';
  if not found then
    perform interno.erro(404, 'Não encontramos este prestador.');
  end if;
  return pro;
end
$$;

create function interno.ja_contatou(pro public.prestadores, conta public.contas) returns boolean
language sql stable set search_path = ''
as $$
  select exists (select 1 from public.contatos where prestador_id = pro.id and cliente_id = conta.id)
$$;

-- Chamada ao tocar em "Falar no WhatsApp". Tocar de novo no mesmo dia não repete o contato.
create function public.registrar_contato(p jsonb default '{}') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  dados jsonb := interno.objeto(p);
  pro public.prestadores := interno.prestador_publicado(dados);
  servico_escolhido text := interno.texto(dados, 'task', 80, 'O serviço');
begin
  -- O próprio prestador testando o botão não conta
  if pro.conta_id = conta.id then
    return;
  end if;
  -- Só vale o nome de um serviço que o prestador oferece
  if not exists (select 1 from public.servicos where prestador_id = pro.id and nome = servico_escolhido) then
    servico_escolhido := '';
  end if;
  update public.contatos
  set servico = case when servico_escolhido <> '' then servico_escolhido else servico end
  where prestador_id = pro.id and cliente_id = conta.id and data = interno.hoje()
    and (servico = servico_escolhido or servico = '' or servico_escolhido = '');
  if found then
    return;
  end if;
  insert into public.contatos (prestador_id, cliente_id, cliente, servico, bairro, data)
  values (pro.id, conta.id, conta.nome, servico_escolhido, conta.bairro, interno.hoje());
end
$$;

-- Se quem está na conta pode avaliar o prestador, e a avaliação que já deu
create function public.minha_avaliacao(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  pro public.prestadores := interno.prestador_publicado(interno.objeto(p));
  minha public.avaliacoes;
begin
  select * into minha from public.avaliacoes where prestador_id = pro.id and cliente_id = conta.id;
  return jsonb_build_object(
    'own', pro.conta_id is not distinct from conta.id,
    'canReview', pro.conta_id is distinct from conta.id and interno.ja_contatou(pro, conta),
    'review', case when minha.id is not null then interno.avaliacao_json(minha) end
  );
end
$$;

-- Dá ou refaz a avaliação. Devolve a avaliação gravada e a nota nova do prestador.
create function public.avaliar(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  dados jsonb := interno.objeto(p);
  pro public.prestadores := interno.prestador_publicado(dados);
  comentario_dado text;
  salva public.avaliacoes;
begin
  if pro.conta_id = conta.id then
    perform interno.erro(403, 'Você não pode avaliar o próprio perfil.');
  end if;
  if not interno.ja_contatou(pro, conta) then
    perform interno.erro(403, format('Fale com %s pelo WhatsApp antes de avaliar.', split_part(pro.nome, ' ', 1)));
  end if;
  if jsonb_typeof(dados -> 'rating') is distinct from 'number'
     or (dados ->> 'rating')::numeric not in (1, 2, 3, 4, 5) then
    perform interno.erro_campo('rating', 'Escolha de 1 a 5 estrelas.');
  end if;
  comentario_dado := interno.texto(dados, 'comment', 500, 'O comentário');

  insert into public.avaliacoes (prestador_id, cliente_id, autor, nota, comentario, data)
  values (pro.id, conta.id, split_part(conta.nome, ' ', 1), (dados ->> 'rating')::integer, comentario_dado, interno.hoje())
  on conflict (prestador_id, cliente_id) do update
  set autor = excluded.autor, nota = excluded.nota, comentario = excluded.comentario, data = excluded.data
  returning * into salva;

  select * into pro from public.prestadores where id = pro.id;
  return jsonb_build_object('review', interno.avaliacao_json(salva), 'rating', pro.nota, 'reviews', pro.total_avaliacoes);
end
$$;

revoke execute on function interno.contar_avaliacao() from public, anon, authenticated;
revoke execute on function interno.avaliacao_json(public.avaliacoes) from public, anon, authenticated;
revoke execute on function interno.prestador_publicado(jsonb) from public, anon, authenticated;
revoke execute on function interno.ja_contatou(public.prestadores, public.contas) from public, anon, authenticated;

revoke execute on function public.registrar_contato(jsonb) from public, anon;
revoke execute on function public.minha_avaliacao(jsonb) from public, anon;
revoke execute on function public.avaliar(jsonb) from public, anon;
grant execute on function public.registrar_contato(jsonb) to authenticated;
grant execute on function public.minha_avaliacao(jsonb) to authenticated;
grant execute on function public.avaliar(jsonb) to authenticated;
