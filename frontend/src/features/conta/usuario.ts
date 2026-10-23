// Contas, agora gravadas no banco pela API. Senha e CPF ficam só no servidor.
// TODO: trocar por Supabase Auth e a tabela de perfis.
import { api, fileToDataUrl, getToken, setToken } from '../../lib/api'

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
  name: string
  // Só dígitos, com DDD
  phone: string
  photo?: string
  address: Address
  // Perfil público como prestador. Sem ele, a pessoa só contrata serviços.
  professionalId?: string
  // Acesso à administração; o servidor confere em cada chamada
  isAdmin?: boolean
}

type Session = { token: string; account: Account }

export async function signIn(email: string, password: string) {
  const session = await api<Session>('POST', '/api/auth/entrar', { email, password })
  setToken(session.token)
  return session.account
}

type NewAccount = {
  name: string
  email: string
  password: string
  asProvider: boolean
  cpf?: string
}

export async function createAccount(data: NewAccount) {
  const session = await api<Session>('POST', '/api/auth/cadastro', data)
  setToken(session.token)
  return session.account
}

export async function signOut() {
  try {
    await api('POST', '/api/auth/sair')
  } finally {
    setToken(undefined)
  }
}

// Conta da sessão guardada nesta aba, se ainda valer
export async function currentAccount() {
  if (!getToken()) return undefined
  try {
    return await api<Account>('GET', '/api/auth/eu')
  } catch {
    return undefined
  }
}

export function updateAccount(changes: Pick<Account, 'name' | 'phone' | 'address'>) {
  return api<Account>('PATCH', '/api/conta', changes)
}

export async function uploadPhoto(file: File) {
  return api<Account>('POST', '/api/conta/foto', { photo: await fileToDataUrl(file) })
}

// Qualquer pessoa pode passar a oferecer serviços a qualquer momento
export function becomeProvider() {
  return api<Account>('POST', '/api/conta/prestador')
}
