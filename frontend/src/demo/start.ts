// Demonstração para o GitHub Pages, que só serve arquivos: a mesma API de server/ roda aqui
// dentro da página, sobre um SQLite em WebAssembly. Cada aparelho tem seus próprios dados.
// Só entra no build do Pages (vite build --mode demo); o app normal fala com a API de verdade.
import { Buffer } from 'buffer'
import { setApiTransport } from '../lib/api'

// A API usa o Buffer do Node; precisa existir antes de carregá-la
;(globalThis as { Buffer?: unknown }).Buffer = Buffer

type Reply = { status: number; headers: Record<string, string>; body: Uint8Array }
type Handle = (req: never, res: never) => Promise<void>

// Uma requisição simulada, com o que o createApp lê (método, endereço, token e corpo)
function dispatch(handle: Handle, method: string, url: string, authorization?: string, body?: string) {
  return new Promise<Reply>((resolve) => {
    const req = {
      method,
      url,
      headers: authorization ? { authorization } : {},
      destroy() {},
      async *[Symbol.asyncIterator]() {
        if (body) yield Buffer.from(body)
      },
    }
    let status = 200
    const headers: Record<string, string> = {}
    const res = {
      writeHead(code: number, values: Record<string, string>) {
        status = code
        Object.assign(headers, values)
      },
      setHeader(name: string, value: string) {
        headers[name] = value
      },
      on() {},
      end(data?: string | Uint8Array) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data ?? new Uint8Array())
        resolve({ status, headers, body: bytes })
      },
    }
    void handle(req as never, res as never)
  })
}

export async function startDemo() {
  const { createApp } = await import('../../server/app.ts')
  const { openDb } = await import('../../server/db.ts')
  const db = await openDb('portal-demo')
  const persist = () => (db as unknown as { persist(): Promise<void> }).persist()
  const handle = createApp(() => db) as unknown as Handle

  // <img src="/api/fotos/…"> não passa pelo fetch: a foto vira um endereço blob: da própria página
  const photos = new Map<string, string>()
  async function photoUrl(path: string) {
    const cached = photos.get(path)
    if (cached) return cached
    const reply = await dispatch(handle, 'GET', path)
    const url = URL.createObjectURL(new Blob([new Uint8Array(reply.body)], { type: reply.headers['Content-Type'] }))
    photos.set(path, url)
    return url
  }

  async function withPhotos(value: unknown): Promise<unknown> {
    if (typeof value === 'string') return /^\/api\/fotos\/[^/]+$/.test(value) ? photoUrl(value) : value
    if (Array.isArray(value)) return Promise.all(value.map(withPhotos))
    if (value && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, item]) => [key, await withPhotos(item)] as const),
      )
      return Object.fromEntries(entries)
    }
    return value
  }

  setApiTransport(async (path, init) => {
    const method = init.method ?? 'GET'
    const headers = (init.headers ?? {}) as Record<string, string>
    const reply = await dispatch(handle, method, path, headers.Authorization, init.body as string | undefined)

    // Gravou: guarda no aparelho antes de responder (a tela pode navegar logo em seguida)
    if (method !== 'GET' && reply.status < 400) await persist()

    if (reply.status === 204 || reply.body.length === 0) return new Response(null, { status: reply.status })
    const data = await withPhotos(JSON.parse(new TextDecoder().decode(reply.body)))
    return new Response(JSON.stringify(data), { status: reply.status, headers: reply.headers })
  })
}
