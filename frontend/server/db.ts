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
  samplePhone,
  samplePhotoId,
  sampleReviews,
} from './seed-data.ts'
import { avatarPng } from './seed-fotos.ts'

// Caminho montado à mão: nos testes de tela o Vite reescreveria `new URL('./schema.sql', import.meta.url)`
const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8')

// O hash da senha de teste é lento de propósito (scrypt); calcula uma vez por processo
let samplePasswordHash: Promise<string> | undefined
// As fotos fictícias também: geradas uma vez por processo
let samplePhotos: Buffer[] | undefined

// Abre (ou cria) o banco, aplica o schema e grava os dados de exemplo se estiver vazio.
// ':memory:' cria um banco só na memória, usado nos testes.
export async function openDb(path: string) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(schema)
  migrate(db)

  const { total } = db.prepare('SELECT count(*) AS total FROM accounts').get() as { total: number }
  if (total === 0) {
    samplePasswordHash ??= hashPassword(SAMPLE_PASSWORD)
    seed(db, await samplePasswordHash)
  }
  return db
}

export type Db = DatabaseSync

// Bancos criados antes de uma coluna nova: o "CREATE TABLE IF NOT EXISTS" do schema não
// mexe em tabela que já existe, então a coluna entra aqui, sem apagar os dados.
function migrate(db: Db) {
  const columns = db.prepare('PRAGMA table_info(services)').all() as { name: string }[]
  if (!columns.some(({ name }) => name === 'unit')) {
    db.exec(
      `ALTER TABLE services ADD COLUMN unit TEXT NOT NULL DEFAULT 'servico'
       CHECK (unit IN ('diaria', 'm2', 'empreita', 'servico', 'hora'))`,
    )
  }
}

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

    const insertPhoto = db.prepare(`INSERT INTO photos (id, mime, data) VALUES (?, 'image/png', ?)`)
    const insertProfessional = db.prepare(
      `INSERT INTO professionals (id, account_id, name, neighborhood, whatsapp, photo_id, about, status, rating, reviews)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'publicado', ?, ?)`,
    )
    // Quem tem conta (Carlos) recebe na conta o mesmo WhatsApp e foto do perfil
    const updateOwner = db.prepare('UPDATE accounts SET phone = ?, photo_id = ? WHERE id = ?')
    const insertService = db.prepare(
      'INSERT INTO services (professional_id, profession_id, name, price, position) VALUES (?, ?, ?, ?, ?)',
    )
    samplePhotos ??= sampleProfessionals.map((_, index) => avatarPng(index))
    sampleProfessionals.forEach((p, index) => {
      const owner = sampleAccounts.find((a) => a.professionalId === p.id)
      const phone = samplePhone(index + 1)
      const photoId = samplePhotoId(p.id)
      insertPhoto.run(photoId, samplePhotos![index])
      insertProfessional.run(
        p.id,
        owner?.id ?? null,
        p.name,
        p.neighborhood,
        phone,
        photoId,
        p.about ?? '',
        p.rating,
        p.reviews,
      )
      if (owner) updateOwner.run(phone, photoId, owner.id)
      Object.entries(p.prices).forEach(([name, price], position) => {
        insertService.run(p.id, p.professionId, name, price, position)
      })
    })

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
