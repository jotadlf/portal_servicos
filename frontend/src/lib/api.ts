// Chamadas ao Supabase. Os dados passam só pelas funções RPC do banco
// (supabase/migrations), que conferem sessão, permissão e dados como a API antiga.
import { getSupabaseClient, SESSION_EXPIRED, SESSION_KEY } from './supabase'

export { SESSION_EXPIRED }

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

const OFFLINE = 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.'
const GENERIC = 'Algo deu errado. Tente de novo.'

// Token da sessão guardada nesta aba, se houver
export function getToken(): string | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? ((JSON.parse(raw) as { access_token?: string }).access_token ?? undefined) : undefined
  } catch {
    return undefined
  }
}

type RpcError = { message: string; code?: string; details?: string | null; hint?: string | null }

// As funções do banco levantam P0001 com o status no hint e os campos (JSON) no details
function toApiError(error: RpcError) {
  if (error.code === 'P0001') {
    let fields: Record<string, string> = {}
    try {
      fields = JSON.parse(error.details || '{}')
    } catch {
      // Sem campos
    }
    return new ApiError(Number(error.hint) || 400, error.message, fields)
  }
  // Sem código: a resposta nem chegou (rede fora, servidor fora do ar)
  if (!error.code) return new ApiError(0, OFFLINE)
  return new ApiError(500, GENERIC)
}

// Chama uma função do banco; todas recebem um objeto só (p) e devolvem JSON
export async function rpc<T>(fn: string, p?: Record<string, unknown>): Promise<T> {
  let result
  try {
    result = await getSupabaseClient().rpc(fn, p === undefined ? {} : { p })
  } catch {
    throw new ApiError(0, OFFLINE)
  }
  if (result.error) {
    const error = toApiError(result.error)
    if (error.status === 401 && getToken()) {
      // A sessão guardada não vale mais: encerra aqui também (o app é avisado pelo SIGNED_OUT)
      await getSupabaseClient().auth.signOut({ scope: 'local' }).catch(() => {})
    }
    throw error
  }
  return result.data as T
}

// Mensagem para mostrar na tela, venha o erro de onde vier
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : GENERIC
}

// ---------- fotos ----------

const BUCKET = 'fotos'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const NOT_AN_IMAGE = 'Escolha um arquivo de imagem, como JPG ou PNG.'

// Assinatura dos primeiros bytes de cada formato aceito (o bucket também só aceita estes).
// SVG fica de fora: pode carregar script.
const signatures: Record<string, { ext: string; matches: (b: Uint8Array) => boolean }> = {
  'image/png': { ext: 'png', matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/jpeg': { ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': {
    ext: 'webp',
    matches: (b) => latin1(b.subarray(0, 4)) === 'RIFF' && latin1(b.subarray(8, 12)) === 'WEBP',
  },
  'image/gif': { ext: 'gif', matches: (b) => latin1(b.subarray(0, 4)) === 'GIF8' },
}

const latin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes)

function readBytes(file: File) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(new ApiError(0, 'Não foi possível ler o arquivo.'))
    reader.readAsArrayBuffer(file)
  })
}

// Envia a imagem para o Storage na pasta indicada e devolve o caminho dela.
// Confere o conteúdo, não só o tipo declarado: um PDF renomeado para .png é recusado.
export async function uploadImage(folder: string, file: File, field: string) {
  if (file.size > MAX_PHOTO_BYTES) throw new ApiError(400, 'A foto precisa ter até 5 MB.', { [field]: 'A foto precisa ter até 5 MB.' })
  const format = signatures[file.type]
  // Vai como bytes, não como File: funciona igual no navegador e nos testes (jsdom)
  const bytes = await readBytes(file)
  if (!format || !format.matches(bytes)) {
    throw new ApiError(400, NOT_AN_IMAGE, { [field]: NOT_AN_IMAGE })
  }
  const path = `${folder}/${crypto.randomUUID()}.${format.ext}`
  let result
  try {
    result = await getSupabaseClient().storage.from(BUCKET).upload(path, bytes, { contentType: file.type })
  } catch {
    throw new ApiError(0, OFFLINE)
  }
  if (result.error) throw new ApiError(400, NOT_AN_IMAGE, { [field]: NOT_AN_IMAGE })
  return path
}

// Apaga uma imagem que não é mais usada; se falhar, ela só fica sobrando no Storage
export async function removeImage(path: string | undefined) {
  if (!path || path.startsWith('exemplos/')) return
  await getSupabaseClient().storage.from(BUCKET).remove([path]).catch(() => {})
}

// Caminho guardado no banco → endereço da imagem. As fotos de exemplo vêm do próprio app.
export function imageUrl(path: string | undefined) {
  if (!path) return undefined
  if (path.startsWith('exemplos/')) return `${import.meta.env.BASE_URL}${path}`
  return getSupabaseClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
