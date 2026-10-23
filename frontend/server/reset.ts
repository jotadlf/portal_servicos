// `npm run db:reset`: apaga o banco local e cria de novo, só com os dados de exemplo
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.ts'

const path = resolve(process.env.PORTAL_DB ?? fileURLToPath(new URL('../data/portal.sqlite', import.meta.url)))
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
mkdirSync(dirname(path), { recursive: true })
const db = await openDb(path)
db.close()
console.log(`Banco recriado: ${path}`)
