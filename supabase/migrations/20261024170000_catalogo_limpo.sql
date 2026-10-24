-- O portal começa sem catálogo: a administração cadastra as modalidades pelo painel.
-- (O Supabase local dos testes recebe as de exemplo pelo seed.sql.)
delete from public.modalidades
where id in ('eletricista', 'faxineira', 'diarista', 'encanador', 'pedreiro', 'pintor', 'montador', 'jardineiro', 'chaveiro')
  and not exists (select 1 from public.servicos s where s.modalidade_id = modalidades.id);

-- Página inicial: só as modalidades e os serviços que algum prestador publicado oferece, para o
-- site não mostrar serviço que ninguém faz. Sem "oferecidos", o catálogo vem inteiro (o painel
-- do prestador escolhe dele, e a administração cuida dele).
create or replace function public.catalogo(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if interno.objeto(p) -> 'oferecidos' = 'true'::jsonb then
    return coalesce((
      select jsonb_agg(interno.modalidade_json(m) || jsonb_build_object('tasks', o.servicos) order by m.posicao)
      from public.modalidades m
      join lateral (
        -- Na ordem das sugestões da modalidade; os criados pelos prestadores vêm depois
        select jsonb_agg(s.nome order by array_position(m.sugestoes, s.nome) nulls last, s.nome) as servicos
        from (
          select distinct sv.nome
          from public.servicos sv
          join public.prestadores pro on pro.id = sv.prestador_id
          where sv.modalidade_id = m.id and pro.status = 'publicado'
        ) s
      ) o on o.servicos is not null
    ), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(interno.modalidade_json(m) order by m.posicao)
    from public.modalidades m
  ), '[]'::jsonb);
end
$$;
