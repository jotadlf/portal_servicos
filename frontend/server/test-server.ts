// Servidor de verdade para os testes: HTTP numa porta livre e SQLite na memória.
// reset() troca o banco por um novo (com os dados de exemplo), isolando cada teste.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from './app.ts'
import { openDb, type Db } from './db.ts'

export async function startTestServer() {
  let db: Db = await openDb(':memory:')
  const server = createServer(createApp(() => db))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  async function request(method: string, path: string, body?: unknown, token?: string) {
    const response = await fetch(url + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const raw = await response.text()
    let json: any
    try {
      json = raw ? JSON.parse(raw) : undefined
    } catch {
      json = raw
    }
    return { status: response.status, body: json, headers: response.headers }
  }

  return {
    url,
    get db() {
      return db
    },
    request,
    async reset() {
      db.close()
      db = await openDb(':memory:')
    },
    async close() {
      await new Promise((resolve) => server.close(resolve))
      db.close()
    },
  }
}

export type TestServer = Awaited<ReturnType<typeof startTestServer>>
