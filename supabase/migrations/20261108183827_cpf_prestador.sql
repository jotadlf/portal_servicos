-- CPF de quem oferece serviços: obrigatório também no botão "Quero oferecer serviços"
-- (antes só o cadastro pedia) e fixo depois de gravado. Quem errou o CPF apaga a conta e
-- cria outra; trocar depois deixaria a pessoa se cadastrar com um CPF e passar a usar outro.

create or replace function public.virar_prestador(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  conta public.contas := interno.conta_atual();
  cpf_informado text;
begin
  if exists (select 1 from public.prestadores where conta_id = conta.id) then
    return interno.conta_json(conta.id);
  end if;
  -- A administração usa o portal sem plano e não precisa de CPF.
  -- Quem já tem CPF gravado não informa de novo: o que vier é ignorado.
  if conta.cpf is null and not conta.admin then
    cpf_informado := interno.so_digitos(interno.texto(interno.objeto(p), 'cpf', 14, 'O CPF'));
    if cpf_informado = '' then
      perform interno.erro_campo('cpf', 'Informe seu CPF.');
    end if;
    if not interno.cpf_valido(cpf_informado) then
      perform interno.erro_campo('cpf', 'Informe um CPF válido.');
    end if;
    if exists (select 1 from public.contas a where a.cpf = cpf_informado) then
      perform interno.erro_campo('cpf', 'Já existe uma conta de prestador com esse CPF.', 409);
    end if;
    update public.contas set cpf = cpf_informado where id = conta.id
    returning * into conta;
  end if;
  perform interno.criar_prestador(conta);
  return interno.conta_json(conta.id);
end
$$;

-- Depois de gravado, o CPF não muda, venha a alteração de onde vier
create function interno.cpf_fixo() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.cpf is not null and new.cpf is distinct from old.cpf then
    perform interno.erro_campo('cpf', 'O CPF não pode ser alterado.');
  end if;
  return new;
end
$$;

create trigger cpf_fixo
  before update of cpf on public.contas
  for each row execute function interno.cpf_fixo();
