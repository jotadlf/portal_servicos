import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './auth.ts'
import {
  SAMPLE_PASSWORD,
  sampleAccounts,
  sampleContacts,
  samplePlanSettings,
  sampleProfessionals,
  sampleProfessions,
  sampleReviews,
} from './seed-data.ts'

// Caminho montado à mão: nos testes de tela o Vite reescreveria `new URL('./schema.sql', import.meta.url)`
const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8')

// O hash da senha de teste é lento de propósito (scrypt); calcula uma vez por processo
let samplePasswordHash: Promise<string> | undefined

// Abre (ou cria) o banco, aplica o schema e grava os dados de exemplo se estiver vazio.
// ':memory:' cria um banco só na memória, usado nos testes.
export async function openDb(path: string) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(schema)

  const { total } = db.prepare('SELECT count(*) AS total FROM accounts').get() as { total: number }
  if (total === 0) {
    samplePasswordHash ??= hashPassword(SAMPLE_PASSWORD)
    seed(db, await samplePasswordHash)
  }
  return db
}

export type Db = DatabaseSync

// Executa várias gravações de uma vez: ou todas entram, ou nenhuma
export function transaction<T>(db: Db, work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function seed(db: Db, passwordHash: string) {
  transaction(db, () => {
    const insertAccount = db.prepare(
      `INSERT INTO accounts (id, email, password_hash, name, neighborhood, city, state, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const a of sampleAccounts) {
      insertAccount.run(a.id, a.email, passwordHash, a.name, a.neighborhood, a.city, a.state, a.isAdmin ? 1 : 0)
    }

    const insertProfession = db.prepare(
      'INSERT INTO professions (id, name, tasks, position) VALUES (?, ?, ?, ?)',
    )
    sampleProfessions.forEach((p, index) => {
      insertProfession.run(p.id, p.name, JSON.stringify(p.tasks), index)
    })

    const insertProfessional = db.prepare(
      `INSERT INTO professionals (id, account_id, name, neighborhood, about, status, rating, reviews)
       VALUES (?, ?, ?, ?, ?, 'publicado', ?, ?)`,
    )
    const insertService = db.prepare(
      'INSERT INTO services (professional_id, profession_id, name, price, position) VALUES (?, ?, ?, ?, ?)',
    )
    for (const p of sampleProfessionals) {
      const owner = sampleAccounts.find((a) => a.professionalId === p.id)
      insertProfessional.run(p.id, owner?.id ?? null, p.name, p.neighborhood, p.about ?? '', p.rating, p.reviews)
      Object.entries(p.prices).forEach(([name, price], index) => {
        insertService.run(p.id, p.professionId, name, price, index)
      })
    }

    const insertReview = db.prepare(
      'INSERT INTO reviews (id, professional_id, author, rating, comment, date) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const r of sampleReviews) {
      insertReview.run(r.id, r.professionalId, r.author, r.rating, r.comment, r.date)
    }

    const insertContact = db.prepare(
      `INSERT INTO contacts (id, professional_id, client, task, message, neighborhood, date, answered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const c of sampleContacts) {
      insertContact.run(c.id, c.professionalId, c.client, c.task, c.message, c.neighborhood, c.date, c.answered ? 1 : 0)
    }

    const s = samplePlanSettings
    db.prepare(
      `INSERT INTO plan_settings (id, monthly_price, semiannual_price, trial_days, gateway, pix_enabled, card_enabled)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
    ).run(s.monthlyPrice, s.semiannualPrice, s.trialDays, s.gateway, s.pixEnabled ? 1 : 0, s.cardEnabled ? 1 : 0)
  })
}
