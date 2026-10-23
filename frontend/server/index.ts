// Sobe a API local: `npm run server` (ou junto com o Vite em `npm run dev`).
// Variáveis: PORT (padrão 3001), PORTAL_DB (arquivo do banco), PORTAL_DB_RESET=1 (começa do zero).
import { mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

const port = Number(process.env.PORT ?? 3001)
const path = resolve(process.env.PORTAL_DB ?? fileURLToPath(new URL('../data/portal.sqlite', import.meta.url)))

if (process.env.PORTAL_DB_RESET === '1') {
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
}
mkdirSync(dirname(path), { recursive: true })

const db = await openDb(path)
const server = createServer(createApp(() => db))
server.listen(port, '127.0.0.1', () => {
  console.log(`API do Portal em http://127.0.0.1:${port} (banco: ${path})`)
})

// Fecha o banco direito ao parar (Ctrl+C), para não deixar arquivo de journal pendurado
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close()
    db.close()
    process.exit(0)
  })
}
