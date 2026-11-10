-- Apagar a conta pede a senha, e a pessoa pode baixar uma cópia dos próprios dados.
--
-- Senha: a tela confere a senha entrando de novo pelo Supabase Auth (que já limita tentativas),
-- então a senha nunca chega ao banco. O banco só aceita apagar se a sessão veio de um login com
-- senha feito há pouco: o JWT traz em "amr" o método e a hora do login, e a hora não muda quando
-- o token é renovado. Quem pegar uma sessão antiga aberta não consegue apagar a conta.

-- Quantos segundos o login com senha vale para ações sensíveis
create function interno.janela_reautenticacao() returns integer
language sql immutable set search_path = ''
as $$ select 300 $$;

create function interno.autenticou_ha_pouco() returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m
    where m ->> 'method' = 'password'
      and (m ->> 'timestamp') ~ '^[0-9]+$'
      and (m ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - interno.janela_reautenticacao()
  )
$$;

create or replace function public.apagar_conta(p jsonb default '{}') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
begin
  -- O portal não pode ficar sem administração
  if conta.admin then
    perform interno.erro(403, 'A conta da administração não pode ser apagada pelo app.');
  end if;
  if not interno.autenticou_ha_pouco() then
    perform interno.erro_campo('password', 'Confirme sua senha para apagar a conta.', 401);
  end if;
  delete from auth.users where id = conta.id;
end
$$;

-- ---------- cópia dos dados ----------

-- Tudo o que o portal guarda sobre a pessoa. O CPF vai mascarado (a pessoa sabe o próprio CPF,
-- e o arquivo baixado pode parar em qualquer lugar); a senha não existe em forma legível.
create function public.meus_dados(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  pro public.prestadores;
  cpf text := interno.decifrar_cpf(conta.cpf_cifrado);
begin
  select * into pro from public.prestadores where conta_id = conta.id;

  return jsonb_build_object(
    'geradoEm', now(),
    'conta', jsonb_build_object(
      'nome', conta.nome,
      'email', conta.email,
      'whatsapp', conta.telefone,
      'endereco', jsonb_build_object(
        'cep', conta.cep, 'rua', conta.rua, 'numero', conta.numero, 'complemento', conta.complemento,
        'bairro', conta.bairro, 'cidade', conta.cidade, 'uf', conta.uf
      ),
      'foto', conta.foto,
      'cpf', case when cpf is not null
        then '***.' || substr(cpf, 4, 3) || '.' || substr(cpf, 7, 3) || '-**' end,
      'dataNascimento', conta.nascimento,
      'criadaEm', conta.criado_em,
      'aceites', jsonb_build_object(
        'termosVersao', conta.termos_versao, 'termosAceitosEm', conta.termos_aceitos_em,
        'privacidadeVersao', conta.privacidade_versao, 'privacidadeAceitaEm', conta.privacidade_aceita_em
      )
    ),
    'prestador', case when pro.id is not null then jsonb_build_object(
      'nome', pro.nome,
      'bairro', pro.bairro,
      'whatsapp', pro.whatsapp,
      'foto', pro.foto,
      'sobre', pro.sobre,
      'situacao', pro.status,
      'plano', pro.plano,
      'formaPagamento', pro.forma_pagamento,
      'fimPeriodoGratis', pro.fim_teste,
      'nota', pro.nota,
      'totalAvaliacoes', pro.total_avaliacoes,
      'criadoEm', pro.criado_em,
      'servicos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'modalidade', s.modalidade_id, 'nome', s.nome, 'preco', s.preco, 'unidade', s.unidade
        ) order by s.posicao, s.id)
        from public.servicos s where s.prestador_id = pro.id
      ), '[]'::jsonb),
      'contatosRecebidos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'cliente', c.cliente, 'bairro', c.bairro, 'servico', c.servico, 'mensagem', c.mensagem,
          'data', c.data, 'respondido', c.respondido
        ) order by c.data desc, c.id)
        from public.contatos c where c.prestador_id = pro.id
      ), '[]'::jsonb),
      'avaliacoesRecebidas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'autor', r.autor, 'nota', r.nota, 'comentario', r.comentario, 'data', r.data
        ) order by r.data desc, r.id)
        from public.avaliacoes r where r.prestador_id = pro.id
      ), '[]'::jsonb)
    ) end,
    'contatosFeitos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'prestador', pr.nome, 'servico', c.servico, 'data', c.data
      ) order by c.data desc, c.id)
      from public.contatos c join public.prestadores pr on pr.id = c.prestador_id
      where c.cliente_id = conta.id
    ), '[]'::jsonb),
    'avaliacoesFeitas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'prestador', pr.nome, 'nota', r.nota, 'comentario', r.comentario, 'data', r.data
      ) order by r.data desc, r.id)
      from public.avaliacoes r join public.prestadores pr on pr.id = r.prestador_id
      where r.cliente_id = conta.id
    ), '[]'::jsonb),
    'pedidosSobreDados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assunto', pe.assunto, 'mensagem', pe.mensagem, 'enviadoEm', pe.criado_em, 'respondidoEm', pe.respondido_em
      ) order by pe.criado_em desc, pe.id)
      from public.pedidos pe where pe.conta_id = conta.id
    ), '[]'::jsonb)
  );
end
$$;

revoke execute on function interno.janela_reautenticacao() from public, anon, authenticated;
revoke execute on function interno.autenticou_ha_pouco() from public, anon, authenticated;
revoke execute on function public.meus_dados(jsonb) from public, anon;
grant execute on function public.meus_dados(jsonb) to authenticated;
