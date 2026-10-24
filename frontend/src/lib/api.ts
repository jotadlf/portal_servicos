// Cliente da API local (SQLite, em server/). Em desenvolvimento o Vite repassa /api para ela.
// O token da sessão fica na sessionStorage: vale só nesta aba, como antes, e sobrevive ao recarregar.
// TODO: trocar pelas chamadas do Supabase mantendo as mesmas funções dos módulos de features/.

const TOKEN_KEY = 'portal.sessao'

// Os testes apontam para o servidor deles; no app, mesma origem
let base = ''
export function setApiBase(url: string) {
  base = url
}

// Quem entrega as respostas: a rede, ou a API rodando na própria página (demonstração do GitHub Pages)
type Transport = (path: string, init: RequestInit) => Promise<Response>
let transport: Transport = (path, init) => fetch(base + path, init)
export function setApiTransport(next: Transport) {
  transport = next
}

export class ApiError extends Error {
  status: number
  // Mensagem por campo, para mostrar embaixo de cada um
  fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

// Avisa o app quando a sessão some (venceu ou foi encerrada em outro lugar)
export const SESSION_EXPIRED = 'portal:sessao-expirada'

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function setToken(token: string | undefined) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sem sessionStorage (modo privado restrito): a sessão vale até recarregar
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  let response: Response
  try {
    response = await transport(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.')
  }

  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(undefined)
      window.dispatchEvent(new Event(SESSION_EXPIRED))
    }
    throw new ApiError(response.status, data.error ?? 'Algo deu errado. Tente de novo.', data.fields)
  }
  return data as T
}

// Mensagem para mostrar na tela, venha o erro de onde vier
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.'
}

// Arquivo escolhido no aparelho → data URL, o formato que a API recebe
export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new ApiError(0, 'Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}
