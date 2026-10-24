// Antes da execução: o Supabase local volta aos dados de exemplo (supabase/seed.sql)
import { closeDb, resetDb } from '../banco/ajuda.ts'

export default async function globalSetup() {
  await resetDb()
  await closeDb()
}
