import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { openDb } from './db.ts'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

describe('Banco: migração', () => {
  it('banco antigo, sem a unidade do preço, ganha a coluna sem perder os serviços', async () => {
    dir = mkdtempSync(join(tmpdir(), 'portal-db-'))
    const path = join(dir, 'antigo.sqlite')

    // Tabela de serviços como era antes da unidade
    const old = new DatabaseSync(path)
    old.exec(`CREATE TABLE services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professional_id TEXT NOT NULL,
      profession_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER,
      position INTEGER NOT NULL
    )`)
    old.prepare(`INSERT INTO services (professional_id, profession_id, name, price, position) VALUES ('p9', 'pintor', 'Pintar muro', 300, 0)`).run()
    old.close()

    const db = await openDb(path)
    expect(db.prepare(`SELECT name, price, unit FROM services WHERE professional_id = 'p9'`).get()).toEqual({
      name: 'Pintar muro',
      price: 300,
      unit: 'servico',
    })
    db.close()
  })
})
