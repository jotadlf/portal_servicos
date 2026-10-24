-- Ajustes apontados pelo verificador de segurança do Supabase.
--
-- O aviso "RLS ligada sem política" nas tabelas de public fica de propósito: as tabelas são
-- fechadas para a API e só as funções RPC (security definer) leem e gravam nelas.

-- Caminho de busca fixo: as funções de apoio já usam nomes completos (public., interno., ...)
alter function interno.colapsar(text) set search_path = '';
alter function interno.conta_atual() set search_path = '';
alter function interno.conta_json(uuid) set search_path = '';
alter function interno.cpf_valido(text) set search_path = '';
alter function interno.criar_prestador(public.contas) set search_path = '';
alter function interno.dados_cadastro(jsonb) set search_path = '';
alter function interno.email_valido(text) set search_path = '';
alter function interno.erro(integer, text, json) set search_path = '';
alter function interno.erro_campo(text, text, integer) set search_path = '';
alter function interno.exigir_admin() set search_path = '';
alter function interno.hoje() set search_path = '';
alter function interno.modalidade_json(public.modalidades) set search_path = '';
alter function interno.nome_pessoa(jsonb, text) set search_path = '';
alter function interno.nome_valido(text) set search_path = '';
alter function interno.normalizar(text) set search_path = '';
alter function interno.objeto(jsonb) set search_path = '';
alter function interno.plano_json() set search_path = '';
alter function interno.preco_plano(jsonb, text) set search_path = '';
alter function interno.prestador_json(public.prestadores, boolean) set search_path = '';
alter function interno.prestador_proprio() set search_path = '';
alter function interno.so_digitos(text) set search_path = '';
alter function interno.telefone_valido(text) set search_path = '';
alter function interno.texto(jsonb, text, integer, text) set search_path = '';
alter function interno.uf_valida(text) set search_path = '';

-- Quem não entrou na conta só chama as funções públicas (catalogo, plano, prestadores,
-- prestador, avaliacoes, validar_cadastro). As demais continuam conferindo a sessão por dentro;
-- sem a permissão, o PostgREST responde 42501, que o app trata como 401.
revoke execute on function public.minha_conta(jsonb) from public, anon;
revoke execute on function public.salvar_conta(jsonb) from public, anon;
revoke execute on function public.definir_foto(jsonb) from public, anon;
revoke execute on function public.virar_prestador(jsonb) from public, anon;
revoke execute on function public.meu_prestador(jsonb) from public, anon;
revoke execute on function public.salvar_servicos(jsonb) from public, anon;
revoke execute on function public.salvar_sobre(jsonb) from public, anon;
revoke execute on function public.publicar(jsonb) from public, anon;
revoke execute on function public.meus_contatos(jsonb) from public, anon;
revoke execute on function public.marcar_respondido(jsonb) from public, anon;
revoke execute on function public.adicionar_modalidade(jsonb) from public, anon;
revoke execute on function public.remover_modalidade(jsonb) from public, anon;
revoke execute on function public.salvar_plano(jsonb) from public, anon;
revoke execute on function public.estatisticas(jsonb) from public, anon;
