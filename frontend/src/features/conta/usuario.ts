// Contas: login no Supabase Auth, dados na conta (public.contas). O CPF e a data de nascimento
// ficam só no banco.
import { ApiError, imageUrl, removeFolder, removeImage, rpc, uploadImage } from '../../lib/api'
import { PHOTO } from '../../lib/imagem'
import { PRIVACY_VERSION, TERMS_VERSION } from '../../lib/controlador'
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
  // AAAA-MM-DD
  birthDate?: string
  // Marcou "Li e aceito os termos de uso e a política de privacidade"
  acceptedTerms: boolean
}

const passwordError = (message: string) => new ApiError(400, message, { password: message })

export async function createAccount(account: NewAccount) {
  const { name, email, password, asProvider, cpf, birthDate } = account
  // Vão as versões que a pessoa aceitou; o banco recusa sem elas
  const termsVersion = account.acceptedTerms ? TERMS_VERSION : undefined
  const privacyVersion = account.acceptedTerms ? PRIVACY_VERSION : undefined
  // O banco confere tudo antes de criar o login, para o erro sair no campo certo.
  // Da senha, só o tamanho em bytes (o limite do bcrypt é em bytes).
  const passwordLength = new TextEncoder().encode(password).length
  await rpc('validar_cadastro', { name, email, asProvider, cpf, birthDate, termsVersion, privacyVersion, passwordLength })

  let result
  try {
    result = await auth().signUp({
      email: email.trim().toLowerCase(),
      password,
      // O perfil nasce no banco a partir destes dados (gatilho nova_conta), conferidos de novo lá
      options: {
        data: {
          name,
          asProvider,
          cpf: asProvider ? cpf : undefined,
          birthDate: asProvider ? birthDate : undefined,
          termsVersion,
          privacyVersion,
        },
      },
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

const WRONG_PASSWORD = 'Senha incorreta.'

// Confere a senha entrando de novo pelo Supabase Auth: a senha não passa pelo banco, e a sessão
// nova registra a hora do login, que o banco exige recente para ações sensíveis.
async function confirmPassword(email: string, password: string) {
  if (!password) throw new ApiError(400, 'Digite sua senha.', { password: 'Digite sua senha.' })
  let result
  try {
    result = await auth().signInWithPassword({ email, password })
  } catch {
    throw new ApiError(0, OFFLINE)
  }
  if (result.error) {
    if (isOffline(result.error)) throw new ApiError(0, OFFLINE)
    throw new ApiError(401, WRONG_PASSWORD, { password: WRONG_PASSWORD })
  }
}

// Apaga a conta para sempre, depois de conferir a senha: primeiro as fotos da pasta dela no
// Storage (o banco não consegue), depois a conta, que leva junto perfil, serviços, contatos,
// avaliações e pedidos.
export async function deleteAccount(password: string) {
  const { id, email, isAdmin } = await rpc<AccountData>('minha_conta')
  // O banco recusa; aqui só evita apagar as fotos antes da recusa
  if (isAdmin) throw new ApiError(403, 'A conta da administração não pode ser apagada pelo app.')
  await confirmPassword(email, password)
  await removeFolder(id)
  await rpc('apagar_conta')
  await auth().signOut({ scope: 'local' }).catch(() => {})
}

// Cópia de tudo o que o portal guarda sobre a pessoa, num arquivo JSON
export async function downloadMyData() {
  const data = await rpc<Record<string, unknown>>('meus_dados')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `meus-dados-portal-de-servicos-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  // Dá tempo ao navegador de começar o download antes de soltar o arquivo da memória
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return data
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
  const path = await uploadImage(before.id, file, 'photo', PHOTO)
  const updated = await rpc<AccountData>('definir_foto', { path })
  await removeImage(before.photo)
  return toAccount(updated)
}

// Qualquer pessoa pode passar a oferecer serviços a qualquer momento, informando o CPF e a
// data de nascimento (a administração não precisa). Depois de gravados, não mudam.
export async function becomeProvider(cpf?: string, birthDate?: string) {
  return toAccount(await rpc<AccountData>('virar_prestador', { cpf, birthDate }))
}
