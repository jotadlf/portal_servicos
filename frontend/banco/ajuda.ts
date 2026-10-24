// Ajudantes dos testes do banco (banco/*.test.ts) e das telas (src/test/supabase.ts).
// Falam com o Supabase local (`supabase start`): a API pelo supabase-js, como o app, e o
// Postgres direto (pg) para conferir o que foi gravado e voltar aos dados de exemplo.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'
import { isoDate } from '../src/features/conta/plano.ts'

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Números e datas como no app: numeric e count(*) viram number; date fica AAAA-MM-DD
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number.parseFloat)
pg.types.setTypeParser(pg.types.builtins.INT8, Number)
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

let pool: pg.Pool | undefined
const db = () => (pool ??= new pg.Pool({ connectionString: DB_URL, max: 2 }))

// Lê direto do banco, para conferir o que a API gravou. Parâmetros: $1, $2…
export async function row(sql: string, ...args: unknown[]) {
  return (await db().query(sql, args)).rows[0] as Record<string, any> | undefined
}

export async function rows(sql: string, ...args: unknown[]) {
  return (await db().query(sql, args)).rows as Record<string, any>[]
}

export async function exec(sql: string, ...args: unknown[]) {
  await db().query(sql, args)
}

// Apaga tudo e grava os dados de exemplo de novo (supabase/seed.sql)
export const resetDb = () => exec('select public.recriar_dados_exemplo()')

export async function closeDb() {
  await pool?.end()
  pool = undefined
}

// Ids das contas de exemplo (seed.sql)
export const SAMPLE_IDS = {
  carlos: '00000000-0000-4000-8000-000000000001',
  beatriz: '00000000-0000-4000-8000-000000000002',
  admin: '00000000-0000-4000-8000-000000000003',
}

// Um cliente por pessoa: cada um guarda a própria sessão, como um aparelho diferente
export function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type Response = { status: number; body: any }

// Chama a função do banco e devolve como a API antiga: status e corpo ({ error, fields } no erro)
export async function call(fn: string, p?: unknown, client: SupabaseClient = newClient()): Promise<Response> {
  const { data, error } = await client.rpc(fn, p === undefined ? {} : { p })
  if (!error) return { status: 200, body: data }
  if (error.code === 'P0001') {
    return { status: Number(error.hint), body: { error: error.message, fields: JSON.parse(error.details || '{}') } }
  }
  return { status: 500, body: { error: error.message, code: error.code } }
}

// PNG de 1x1 pixel, válido
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

let counter = 0
export function uniqueEmail(prefix = 'teste') {
  counter += 1
  return `${prefix}.${counter}.${Date.now()}@exemplo.com`
}

// CPFs válidos (dígitos verificadores certos) para os cadastros de prestador
export const VALID_CPFS = ['52998224725', '11144477735', '12345678909', '39053344705', '71428793860']

type SignUpData = { name: unknown; email: unknown; password: unknown; asProvider: unknown; cpf: unknown }

// O cadastro como o app faz: o banco confere os dados e só então o Supabase Auth cria o login
export async function cadastro(data: Partial<SignUpData>, client = newClient()) {
  const { password, ...rest } = data
  const passwordLength = typeof password === 'string' ? Buffer.byteLength(password) : undefined
  const checked = await call('validar_cadastro', { ...rest, passwordLength }, client)
  if (checked.status !== 200) return checked
  const { error } = await client.auth.signUp({
    email: String(data.email).trim().toLowerCase(),
    password: String(password),
    options: { data: { name: data.name, asProvider: data.asProvider, cpf: data.asProvider ? data.cpf : undefined } },
  })
  if (error) return { status: error.status ?? 500, body: { error: error.message, code: error.code } }
  const me = await call('minha_conta', undefined, client)
  return { status: me.status, body: { account: me.body } }
}

export async function signUp(data: Partial<SignUpData> = {}) {
  const client = newClient()
  const response = await cadastro(
    { name: 'Ana Lima', email: uniqueEmail(), password: 'segredo1', asProvider: false, ...data },
    client,
  )
  if (response.status !== 200) throw new Error(`cadastro falhou: ${JSON.stringify(response.body)}`)
  return { client, account: response.body.account as { id: string; professionalId?: string; email: string } }
}

export async function entrar(email: string, password: string, client = newClient()) {
  const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  return error ? { status: error.status ?? 400, client } : { status: 200, client }
}

export async function signIn(email: string, password = 'teste123') {
  const { status, client } = await entrar(email, password)
  if (status !== 200) throw new Error(`login falhou: ${email}`)
  return client
}

// Envia a foto para a pasta da conta no Storage e a define como foto da conta
export async function sendPhoto(client: SupabaseClient, accountId: string, data = PNG_1PX, type = 'image/png') {
  const path = `${accountId}/${crypto.randomUUID()}.png`
  const upload = await client.storage.from('fotos').upload(path, data, { contentType: type })
  if (upload.error) return { status: 400, body: { error: upload.error.message }, path }
  return { ...(await call('definir_foto', { path }, client)), path }
}

// Prestador com tudo que a publicação exige: foto, WhatsApp e um serviço
export async function readyProvider(cpf = VALID_CPFS[0]) {
  const { client, account } = await signUp({ asProvider: true, cpf })
  await sendPhoto(client, account.id)
  await call('salvar_conta', { name: 'Ana Lima', phone: '62999998888', address: { neighborhood: 'Setor Oeste' } }, client)
  await call(
    'salvar_servicos',
    { services: [{ professionId: 'eletricista', name: 'Instalar chuveiro', price: 130 }] },
    client,
  )
  return { client, account }
}

// Data (AAAA-MM-DD) de hoje no fuso do portal, como o banco calcula
export function todayInBrazil(plusDays = 0) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  now.setDate(now.getDate() + plusDays)
  return isoDate(now)
}
