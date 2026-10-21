// Contas do protótipo. Serão substituídas pelo Supabase Auth e pela tabela de perfis.
import { addProfessional, getProfessional, updateProfessional } from '../profissionais/dados-exemplo'

export type Address = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export type Account = {
  id: string
  email: string
  // Só no protótipo. No Supabase a senha nunca fica guardada no app.
  password: string
  name: string
  // Só dígitos, com DDD
  phone: string
  photo?: string
  address: Address
  // Perfil público como prestador. Sem ele, a pessoa só contrata serviços.
  professionalId?: string
}

const emptyAddress: Address = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

// Usuários de teste (senha: teste123):
// - carlos@exemplo.com: prestador desde o início (eletricista, com contatos e avaliações)
// - beatriz@exemplo.com: só consumidora
const accounts: Account[] = [
  {
    id: 'u1',
    email: 'carlos@exemplo.com',
    password: 'teste123',
    name: 'Carlos Henrique',
    phone: '',
    address: { ...emptyAddress, neighborhood: 'Setor Bueno', city: 'Goiânia', state: 'GO' },
    professionalId: 'p1',
  },
  {
    id: 'u2',
    email: 'beatriz@exemplo.com',
    password: 'teste123',
    name: 'Beatriz Rocha',
    phone: '',
    address: { ...emptyAddress, neighborhood: 'Setor Marista', city: 'Goiânia', state: 'GO' },
  },
]

function sameEmail(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function getAccount(id: string) {
  return accounts.find((account) => account.id === id)
}

// TODO: trocar por supabase.auth.signInWithPassword
export function signIn(email: string, password: string) {
  return accounts.find((account) => sameEmail(account.email, email) && account.password === password)
}

export function isEmailTaken(email: string) {
  return accounts.some((account) => sameEmail(account.email, email))
}

type NewAccount = {
  name: string
  email: string
  password: string
  asProvider: boolean
}

// TODO: trocar por supabase.auth.signUp
export function createAccount({ name, email, password, asProvider }: NewAccount) {
  const account: Account = {
    id: `u${Date.now()}`,
    email: email.trim().toLowerCase(),
    password,
    name: name.trim(),
    phone: '',
    address: { ...emptyAddress },
  }
  accounts.push(account)
  if (asProvider) becomeProvider(account.id)
  return account
}

// Qualquer pessoa pode passar a oferecer serviços a qualquer momento
export function becomeProvider(accountId: string) {
  const account = getAccount(accountId)
  if (!account || account.professionalId) return
  const professional = addProfessional({
    name: account.name,
    neighborhood: account.address.neighborhood,
    whatsapp: account.phone || undefined,
    photo: account.photo,
  })
  account.professionalId = professional.id
}

// Protótipo: altera só em memória, até recarregar a página.
// TODO: gravar no Supabase.
export function updateAccount(
  accountId: string,
  changes: Partial<Omit<Account, 'id' | 'email' | 'password' | 'professionalId'>>,
) {
  const account = getAccount(accountId)
  if (!account) return
  Object.assign(account, changes)

  // O perfil público usa os dados do Perfil; só o bairro do endereço fica visível
  if (account.professionalId) {
    updateProfessional(account.professionalId, {
      name: account.name,
      whatsapp: account.phone || undefined,
      neighborhood: account.address.neighborhood,
      photo: account.photo,
    })
  }
}

export function getAccountProfessional(account: Account) {
  return account.professionalId ? getProfessional(account.professionalId) : undefined
}
