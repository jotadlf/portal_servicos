-- A própria pessoa apaga a conta: o login some do Supabase Auth e, em cascata, o perfil,
-- o prestador, os serviços, os contatos e as avaliações. As sessões abertas deixam de valer.
-- As fotos do Storage a tela apaga antes (o Supabase não deixa apagar arquivo pelo SQL).
-- É também o caminho para quem errou o CPF, que não pode ser trocado: apagar e criar outra.

create function public.apagar_conta(p jsonb default '{}') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
begin
  -- O portal não pode ficar sem administração
  if conta.admin then
    perform interno.erro(403, 'A conta da administração não pode ser apagada pelo app.');
  end if;
  delete from auth.users where id = conta.id;
end
$$;

revoke execute on function public.apagar_conta(jsonb) from public, anon;
grant execute on function public.apagar_conta(jsonb) to authenticated;
