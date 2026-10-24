// Contas: login no Supabase Auth, dados no perfil (public.profiles). O CPF fica só no banco.
import { ApiError, imageUrl, removeImage, rpc, uploadImage } from '../../lib/api'
import { getSupabaseClient } from '../../lib/supabase'

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
  // Acesso à administração; o banco confere em cada chamada
  isAdmin?: boolean
}

// Como o banco devolve: a foto é o caminho no Storage
type AccountData = Account

const toAccount = (data: AccountData): Account => ({ ...data, photo: imageUrl(data.photo) })

const auth = () => getSupabaseClient().auth

const OFFLINE = 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.'

// Erro do Supabase Auth sem resposta do servidor (rede fora)
const isOffline = (error: { name?: string; status?: number }) =>
  error.name === 'AuthRetryableFetchError' || error.status === 0

export async function signIn(email: string, password: string) {
  let result
  try {
    result = await auth().signInWithPassword({ email: email.trim().toLowerCase(), password })
  } catch {
    throw new ApiError(0, OFFLINE)
  }
  if (result.error) {
    if (isOffline(result.error)) throw new ApiError(0, OFFLINE)
    throw new ApiError(401, 'E-mail ou senha incorretos. Confira e tente de novo.')
  }
  return toAccount(await rpc<AccountData>('minha_conta'))
}

type NewAccount = {
  name: string
  email: string
  password: string
  asProvider: boolean
  cpf?: string
}

const passwordError = (message: string) => new ApiError(400, message, { password: message })

export async function createAccount({ name, email, password, asProvider, cpf }: NewAccount) {
  // O banco confere tudo antes de criar o login, para o erro sair no campo certo.
  // Da senha, só o tamanho em bytes (o limite do bcrypt é em bytes).
  const passwordLength = new TextEncoder().encode(password).length
  await rpc('validar_cadastro', { name, email, asProvider, cpf, passwordLength })

  let result
  try {
    result = await auth().signUp({
      email: email.trim().toLowerCase(),
      password,
      // O perfil nasce no banco a partir destes dados (gatilho nova_conta), conferidos de novo lá
      options: { data: { name, asProvider, cpf: asProvider ? cpf : undefined } },
    })
  } catch {
    throw new ApiError(0, OFFLINE)
  }
  const { data, error } = result
  if (error) {
    if (isOffline(error)) throw new ApiError(0, OFFLINE)
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      const message = 'Já existe uma conta com esse e-mail. Entre com ele ou use outro.'
      throw new ApiError(409, message, { email: message })
    }
    if (error.code === 'weak_password') throw passwordError('A senha precisa ter pelo menos 6 caracteres.')
    if (error.code === 'over_request_rate_limit' || error.status === 429) {
      throw new ApiError(429, 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.')
    }
    throw new ApiError(500, 'Algo deu errado. Tente de novo.')
  }
  // Projeto com confirmação de e-mail ligada: a conta só entra depois do link
  if (!data.session) {
    throw new ApiError(400, 'Enviamos um link de confirmação para o seu e-mail. Abra o link e depois entre.')
  }
  return toAccount(await rpc<AccountData>('minha_conta'))
}

// Encerra só a sessão deste aparelho
export async function signOut() {
  await auth().signOut({ scope: 'local' })
}

// Conta da sessão guardada nesta aba, se ainda valer
export async function currentAccount() {
  try {
    const { data } = await auth().getSession()
    if (!data.session) return undefined
    return toAccount(await rpc<AccountData>('minha_conta'))
  } catch {
    return undefined
  }
}

export async function updateAccount(changes: Pick<Account, 'name' | 'phone' | 'address'>) {
  return toAccount(await rpc<AccountData>('salvar_conta', changes))
}

// A foto vai para a pasta da conta no Storage; depois o banco passa a usá-la e a antiga sai
export async function uploadPhoto(file: File) {
  const before = await rpc<AccountData>('minha_conta')
  const path = await uploadImage(before.id, file, 'photo')
  const updated = await rpc<AccountData>('definir_foto', { path })
  await removeImage(before.photo)
  return toAccount(updated)
}

// Qualquer pessoa pode passar a oferecer serviços a qualquer momento
export async function becomeProvider() {
  return toAccount(await rpc<AccountData>('virar_prestador'))
}
