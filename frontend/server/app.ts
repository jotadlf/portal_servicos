// API do protótipo sobre o SQLite. Cada rota confere sessão, permissão e dados no servidor,
// mesmo que a tela já confira: quem chama a API direto não passa por cima das regras.
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isValidUf } from '../src/lib/cep.ts'
import { isValidCpf } from '../src/lib/cpf.ts'
import { isValidEmail } from '../src/lib/email.ts'
import { normalize } from '../src/lib/format.ts'
import { isValidName, NAME_ERROR } from '../src/lib/nome.ts'
import { isValidPhone } from '../src/lib/whatsapp.ts'
import {
  findPlan,
  gateways,
  isoDate,
  monthlyValue,
  trialEndDate,
  type PlanId,
  type PlanSettings,
} from '../src/features/conta/plano.ts'
import { DUMMY_HASH, SESSION_DAYS, hashPassword, hashToken, newSessionToken, verifyPassword } from './auth.ts'
import { transaction, type Db } from './db.ts'

// ---------- infraestrutura ----------

class HttpError extends Error {
  status: number
  fields?: Record<string, string>
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

// Erro de validação de um campo: a tela mostra a mensagem embaixo dele
function fieldError(field: string, message: string, status = 400): never {
  throw new HttpError(status, message, { [field]: message })
}

type Viewer = { id: string; isAdmin: boolean; professionalId?: string } | undefined

type Context = {
  db: Db
  params: Record<string, string>
  query: URLSearchParams
  body: Record<string, unknown>
  viewer: Viewer
  token?: string
}

type Access = 'public' | 'user' | 'admin'
type Handler = (ctx: Context) => unknown | Promise<unknown>
type Route = { method: string; parts: string[]; access: Access; handler: Handler }

const routes: Route[] = []
function route(method: string, path: string, access: Access, handler: Handler) {
  routes.push({ method, parts: path.split('/').filter(Boolean), access, handler })
}

function match(parts: string[], path: string[]) {
  if (parts.length !== path.length) return undefined
  const params: Record<string, string> = {}
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(path[i])
    else if (parts[i] !== path[i]) return undefined
  }
  return params
}

// Foto em base64 chega a ~6,7 MB; acima disso nem lê
const MAX_BODY = 8 * 1024 * 1024

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'O envio é grande demais.')
    chunks.push(chunk as Buffer)
  }
  if (size === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Dados em formato inválido.')
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

function viewerFromToken(db: Db, token: string | undefined): Viewer {
  if (!token) return undefined
  const row = db
    .prepare(
      `SELECT a.id, a.is_admin, p.id AS professional_id FROM sessions s
       JOIN accounts a ON a.id = s.account_id
       LEFT JOIN professionals p ON p.account_id = a.id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    )
    .get(hashToken(token)) as { id: string; is_admin: number; professional_id: string | null } | undefined
  if (!row) return undefined
  return { id: row.id, isAdmin: row.is_admin === 1, professionalId: row.professional_id ?? undefined }
}

// O banco é trocável: os testes começam cada caso com um banco novo
export function createApp(getDb: () => Db) {
  return async function handle(req: IncomingMessage, res: ServerResponse) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname.split('/').filter(Boolean)
      const db = getDb()

      // Fotos voltam como imagem, não como JSON
      if (req.method === 'GET' && path[0] === 'api' && path[1] === 'fotos' && path.length === 3) {
        return sendPhoto(db, decodeURIComponent(path[2]), res)
      }

      let found: { route: Route; params: Record<string, string> } | undefined
      let pathExists = false
      for (const r of routes) {
        const params = match(r.parts, path)
        if (!params) continue
        pathExists = true
        if (r.method === req.method) {
          found = { route: r, params }
          break
        }
      }
      if (!found) throw new HttpError(pathExists ? 405 : 404, 'Endereço não encontrado.')

      const auth = req.headers.authorization
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
      const viewer = viewerFromToken(db, token)
      if (found.route.access !== 'public' && !viewer) {
        throw new HttpError(401, 'Entre na sua conta para continuar.')
      }
      if (found.route.access === 'admin' && !viewer?.isAdmin) {
        throw new HttpError(403, 'Esta área é só para a administração do portal.')
      }

      const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req)
      const result = await found.route.handler({
        db,
        params: found.params,
        query: url.searchParams,
        body,
        viewer,
        token,
      })
      send(res, result === undefined ? 204 : 200, result)
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 413) {
          // O resto do envio grande ainda está chegando: fecha a conexão em vez de reaproveitá-la
          res.setHeader('Connection', 'close')
          res.on('finish', () => req.destroy())
        }
        send(res, error.status, { error: error.message, fields: error.fields })
      } else {
        console.error(error)
        send(res, 500, { error: 'Algo deu errado. Tente de novo.' })
      }
    }
  }
}

// ---------- leitura dos dados recebidos ----------

// Texto opcional: devolve aparado; recusa outro tipo e tamanho acima do limite
function text(body: Record<string, unknown>, field: string, max: number, label: string) {
  const value = body[field] ?? ''
  if (typeof value !== 'string') fieldError(field, `${label} em formato inválido.`)
  const trimmed = value.trim()
  if (trimmed.length > max) fieldError(field, `${label} pode ter até ${max} caracteres.`)
  return trimmed
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')
const collapse = (value: string) => value.replace(/\s+/g, ' ')

function validName(body: Record<string, unknown>, field = 'name') {
  const name = collapse(text(body, field, 60, 'O nome'))
  if (!name) fieldError(field, 'Informe seu nome.')
  if (!isValidName(name)) fieldError(field, NAME_ERROR)
  return name
}

// ---------- fotos ----------

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

// Assinatura dos primeiros bytes de cada formato aceito. SVG fica de fora:
// pode carregar script e seria servido pelo mesmo endereço do app.
const signatures: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
}

function parseImage(value: unknown, field: string) {
  const match = typeof value === 'string' ? /^data:([\w/+.-]+);base64,([A-Za-z0-9+/]+=*)$/.exec(value) : null
  if (!match) fieldError(field, 'Escolha um arquivo de imagem, como JPG ou PNG.')
  const [, mime, base64] = match
  const data = Buffer.from(base64, 'base64')
  if (data.length > MAX_PHOTO_BYTES) fieldError(field, 'A foto precisa ter até 5 MB.')
  const check = signatures[mime]
  // Confere o conteúdo, não só o tipo declarado: um PDF renomeado para .png é recusado
  if (!check || !check(data)) fieldError(field, 'Escolha um arquivo de imagem, como JPG ou PNG.')
  return { mime, data }
}

function savePhoto(db: Db, image: { mime: string; data: Buffer }) {
  const id = randomUUID()
  db.prepare('INSERT INTO photos (id, mime, data) VALUES (?, ?, ?)').run(id, image.mime, image.data)
  return id
}

const photoUrl = (id: string | null) => (id ? `/api/fotos/${id}` : undefined)

function sendPhoto(db: Db, id: string, res: ServerResponse) {
  const row = db.prepare('SELECT mime, data FROM photos WHERE id = ?').get(id) as
    | { mime: string; data: Uint8Array }
    | undefined
  if (!row) return send(res, 404, { error: 'Foto não encontrada.' })
  res.writeHead(200, {
    'Content-Type': row.mime,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  })
  res.end(Buffer.from(row.data))
}

// ---------- contas ----------

type AccountRow = {
  id: string
  email: string
  name: string
  phone: string
  photo_id: string | null
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  is_admin: number
  professional_id: string | null
}

function loadAccount(db: Db, id: string) {
  const row = db
    .prepare(
      `SELECT a.*, p.id AS professional_id FROM accounts a
       LEFT JOIN professionals p ON p.account_id = a.id WHERE a.id = ?`,
    )
    .get(id) as AccountRow | undefined
  if (!row) throw new HttpError(404, 'Conta não encontrada.')
  return row
}

// O que a própria pessoa vê da conta. Senha e CPF nunca saem do servidor.
function accountJson(row: AccountRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    photo: photoUrl(row.photo_id),
    address: {
      cep: row.cep,
      street: row.street,
      number: row.number,
      complement: row.complement,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
    },
    professionalId: row.professional_id ?? undefined,
    isAdmin: row.is_admin === 1 || undefined,
  }
}

function startSession(db: Db, accountId: string) {
  const token = newSessionToken()
  db.prepare(
    `INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, datetime('now', ?))`,
  ).run(hashToken(token), accountId, `+${SESSION_DAYS} days`)
  return token
}

// Cria o perfil de prestador (rascunho) com os dados públicos da conta
function createProfessional(db: Db, account: AccountRow) {
  const id = `p-${randomUUID()}`
  db.prepare(
    `INSERT INTO professionals (id, account_id, name, neighborhood, whatsapp, photo_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, account.id, account.name, account.neighborhood, account.phone, account.photo_id)
  return id
}

route('POST', '/api/auth/cadastro', 'public', async ({ db, body }) => {
  const name = validName(body)
  const email = text(body, 'email', 254, 'O e-mail').toLowerCase()
  if (!email) fieldError('email', 'Informe seu e-mail.')
  if (!isValidEmail(email)) fieldError('email', 'Informe um e-mail válido, como nome@exemplo.com.')

  const password = body.password
  if (typeof password !== 'string' || password.length < 6) {
    fieldError('password', 'A senha precisa ter pelo menos 6 caracteres.')
  }
  if (password.length > 128) fieldError('password', 'A senha pode ter até 128 caracteres.')

  const asProvider = body.asProvider === true
  let cpf: string | null = null
  if (asProvider) {
    cpf = digitsOnly(text(body, 'cpf', 14, 'O CPF'))
    if (!cpf) fieldError('cpf', 'Informe seu CPF.')
    if (!isValidCpf(cpf)) fieldError('cpf', 'Informe um CPF válido.')
  }

  if (db.prepare('SELECT 1 FROM accounts WHERE email = ?').get(email)) {
    fieldError('email', 'Já existe uma conta com esse e-mail. Entre com ele ou use outro.', 409)
  }
  if (cpf && db.prepare('SELECT 1 FROM accounts WHERE cpf = ?').get(cpf)) {
    fieldError('cpf', 'Já existe uma conta de prestador com esse CPF.', 409)
  }

  const passwordHash = await hashPassword(password)
  const id = `u-${randomUUID()}`
  const token = transaction(db, () => {
    db.prepare('INSERT INTO accounts (id, email, password_hash, name, cpf) VALUES (?, ?, ?, ?, ?)').run(
      id,
      email,
      passwordHash,
      name,
      cpf,
    )
    if (asProvider) createProfessional(db, loadAccount(db, id))
    return startSession(db, id)
  })
  return { token, account: accountJson(loadAccount(db, id)) }
})

route('POST', '/api/auth/entrar', 'public', async ({ db, body }) => {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const row = db.prepare('SELECT id, password_hash FROM accounts WHERE email = ?').get(email) as
    | { id: string; password_hash: string }
    | undefined
  // Compara mesmo sem conta, para o tempo de resposta não revelar quais e-mails existem
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH)
  if (!row || !ok) throw new HttpError(401, 'E-mail ou senha incorretos. Confira e tente de novo.')
  return { token: startSession(db, row.id), account: accountJson(loadAccount(db, row.id)) }
})

route('POST', '/api/auth/sair', 'user', ({ db, token }) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token!))
})

route('GET', '/api/auth/eu', 'user', ({ db, viewer }) => accountJson(loadAccount(db, viewer!.id)))

route('PATCH', '/api/conta', 'user', ({ db, viewer, body }) => {
  const current = loadAccount(db, viewer!.id)
  const name = validName(body)

  const phone = digitsOnly(text(body, 'phone', 20, 'O WhatsApp'))
  if (phone && !isValidPhone(phone)) {
    fieldError('phone', 'Informe o WhatsApp com DDD, por exemplo (62) 99999-9999.')
  }

  const address = (body.address ?? {}) as Record<string, unknown>
  if (typeof address !== 'object' || Array.isArray(address)) fieldError('address', 'Endereço em formato inválido.')
  const cep = digitsOnly(text(address, 'cep', 9, 'O CEP'))
  if (cep && cep.length !== 8) fieldError('cep', 'Complete os 8 números do CEP.')
  const street = text(address, 'street', 80, 'A rua')
  const number = text(address, 'number', 20, 'O número')
  const complement = text(address, 'complement', 60, 'O complemento')
  const neighborhood = text(address, 'neighborhood', 50, 'O bairro')
  const city = collapse(text(address, 'city', 50, 'A cidade'))
  if (city && !isValidName(city)) fieldError('city', 'Use só letras no nome da cidade.')
  const state = text(address, 'state', 2, 'A UF').toUpperCase()
  if (state && !isValidUf(state)) fieldError('state', 'UF inválida.')

  // A foto é enviada antes, em /api/conta/foto; aqui só confere que existe
  if (current.professional_id && !current.photo_id) {
    fieldError('photo', 'Adicione uma foto: ela aparece no seu perfil de prestador.')
  }

  transaction(db, () => {
    db.prepare(
      `UPDATE accounts SET name = ?, phone = ?, cep = ?, street = ?, number = ?, complement = ?,
       neighborhood = ?, city = ?, state = ? WHERE id = ?`,
    ).run(name, phone, cep, street, number, complement, neighborhood, city, state, current.id)
    // O perfil público usa os dados da conta; do endereço, só o bairro aparece
    db.prepare('UPDATE professionals SET name = ?, whatsapp = ?, neighborhood = ? WHERE account_id = ?').run(
      name,
      phone,
      neighborhood,
      current.id,
    )
  })
  return accountJson(loadAccount(db, current.id))
})

route('POST', '/api/conta/foto', 'user', ({ db, viewer, body }) => {
  const image = parseImage(body.photo, 'photo')
  const current = loadAccount(db, viewer!.id)
  transaction(db, () => {
    const id = savePhoto(db, image)
    db.prepare('UPDATE accounts SET photo_id = ? WHERE id = ?').run(id, current.id)
    db.prepare('UPDATE professionals SET photo_id = ? WHERE account_id = ?').run(id, current.id)
    // A foto antiga não é mais usada por ninguém
    if (current.photo_id) db.prepare('DELETE FROM photos WHERE id = ?').run(current.photo_id)
  })
  return accountJson(loadAccount(db, current.id))
})

route('POST', '/api/conta/prestador', 'user', ({ db, viewer }) => {
  const current = loadAccount(db, viewer!.id)
  if (!current.professional_id) createProfessional(db, current)
  return accountJson(loadAccount(db, current.id))
})

// ---------- prestadores ----------

type ProfessionalRow = {
  id: string
  account_id: string | null
  name: string
  neighborhood: string
  whatsapp: string
  photo_id: string | null
  about: string
  status: 'rascunho' | 'publicado'
  plan: PlanId | null
  trial_ends_at: string | null
  rating: number
  reviews: number
}

type ServiceRow = { professional_id: string; profession_id: string; name: string; price: number | null }

// Média bayesiana: poucas avaliações puxam a nota para a média geral,
// para que 5,0 com 3 avaliações não passe na frente de 4,9 com 132.
const PRIOR_REVIEWS = 10
const PRIOR_RATING = 4
const reputation = ({ rating, reviews }: ProfessionalRow) =>
  (rating * reviews + PRIOR_RATING * PRIOR_REVIEWS) / (reviews + PRIOR_REVIEWS)

// Sem login: só o primeiro nome, sem preços nem WhatsApp. Esses dados nem saem do servidor.
function professionalJson(row: ProfessionalRow, services: ServiceRow[], viewer: Viewer) {
  const full = viewer !== undefined
  return {
    id: row.id,
    name: full ? row.name : row.name.split(' ')[0],
    services: services.map((s) => ({
      professionId: s.profession_id,
      name: s.name,
      price: full ? s.price : null,
      hidden: !full && s.price !== null ? true : undefined,
    })),
    photo: photoUrl(row.photo_id),
    status: row.status,
    trialEndsAt: row.trial_ends_at ?? undefined,
    plan: row.plan ?? undefined,
    rating: row.rating,
    reviews: row.reviews,
    neighborhood: row.neighborhood,
    about: row.about || undefined,
    whatsapp: full && row.whatsapp ? row.whatsapp : undefined,
  }
}

function servicesOf(db: Db, ids: string[]) {
  if (ids.length === 0) return new Map<string, ServiceRow[]>()
  const rows = db
    .prepare(
      `SELECT professional_id, profession_id, name, price FROM services
       WHERE professional_id IN (${ids.map(() => '?').join(',')}) ORDER BY position, id`,
    )
    .all(...ids) as ServiceRow[]
  const byPro = new Map<string, ServiceRow[]>()
  for (const row of rows) byPro.set(row.professional_id, [...(byPro.get(row.professional_id) ?? []), row])
  return byPro
}

function ownProfessional(db: Db, viewer: Viewer) {
  if (!viewer?.professionalId) throw new HttpError(403, 'Você ainda não oferece serviços.')
  return db.prepare('SELECT * FROM professionals WHERE id = ?').get(viewer.professionalId) as ProfessionalRow
}

route('GET', '/api/prestadores', 'public', ({ db, query, viewer }) => {
  const professionId = query.get('profissao') ?? ''
  const task = query.get('servico') ?? ''
  const rows = db
    .prepare(
      `SELECT DISTINCT p.* FROM professionals p JOIN services s ON s.professional_id = p.id
       WHERE p.status = 'publicado' AND s.profession_id = ? AND s.name = ?`,
    )
    .all(professionId, task) as ProfessionalRow[]
  rows.sort((a, b) => reputation(b) - reputation(a))
  const services = servicesOf(db, rows.map((r) => r.id))
  return rows.map((row) => professionalJson(row, services.get(row.id) ?? [], viewer))
})

route('GET', '/api/prestadores/:id', 'public', ({ db, params, viewer }) => {
  const row = db.prepare('SELECT * FROM professionals WHERE id = ?').get(params.id) as ProfessionalRow | undefined
  // Rascunho só aparece para o próprio prestador
  const isOwner = row !== undefined && viewer !== undefined && row.account_id === viewer.id
  if (!row || (row.status !== 'publicado' && !isOwner)) throw new HttpError(404, 'Não encontramos este prestador.')
  return professionalJson(row, servicesOf(db, [row.id]).get(row.id) ?? [], viewer)
})

route('GET', '/api/prestadores/:id/avaliacoes', 'public', ({ db, params }) =>
  db
    .prepare(
      `SELECT r.id, r.professional_id AS professionalId, r.author, r.rating, r.comment, r.date
       FROM reviews r JOIN professionals p ON p.id = r.professional_id
       WHERE r.professional_id = ? AND p.status = 'publicado' ORDER BY r.date DESC`,
    )
    .all(params.id),
)

route('GET', '/api/prestador', 'user', ({ db, viewer }) => {
  const row = ownProfessional(db, viewer)
  return professionalJson(row, servicesOf(db, [row.id]).get(row.id) ?? [], viewer)
})

route('PUT', '/api/prestador/servicos', 'user', ({ db, viewer, body }) => {
  const pro = ownProfessional(db, viewer)
  if (!Array.isArray(body.services)) fieldError('services', 'Lista de serviços em formato inválido.')
  if (body.services.length > 100) fieldError('services', 'Cadastre até 100 serviços.')

  const professions = new Set(
    (db.prepare('SELECT id FROM professions').all() as { id: string }[]).map((p) => p.id),
  )
  const seen = new Set<string>()
  const services = body.services.map((raw: unknown) => {
    const item = (raw ?? {}) as Record<string, unknown>
    const professionId = typeof item.professionId === 'string' ? item.professionId : ''
    if (!professions.has(professionId)) fieldError('professionId', 'Escolha uma profissão do catálogo.')
    const name = collapse(text(item, 'name', 60, 'O nome do serviço'))
    if (!name) fieldError('name', 'Informe o nome do serviço.')
    const key = `${professionId}|${normalize(name)}`
    if (seen.has(key)) fieldError('name', 'Você já tem um serviço com esse nome nesta profissão.')
    seen.add(key)
    const price = item.price ?? null
    if (price !== null && (!Number.isInteger(price) || (price as number) < 0 || (price as number) > 999999)) {
      fieldError('price', 'Informe o preço em reais inteiros, até 999999.')
    }
    return { professionId, name, price: price as number | null }
  })

  transaction(db, () => {
    db.prepare('DELETE FROM services WHERE professional_id = ?').run(pro.id)
    const insert = db.prepare(
      'INSERT INTO services (professional_id, profession_id, name, price, position) VALUES (?, ?, ?, ?, ?)',
    )
    services.forEach((s, index) => insert.run(pro.id, s.professionId, s.name, s.price, index))
  })
  return professionalJson(pro, servicesOf(db, [pro.id]).get(pro.id) ?? [], viewer)
})

route('PATCH', '/api/prestador/sobre', 'user', ({ db, viewer, body }) => {
  const pro = ownProfessional(db, viewer)
  const about = text(body, 'about', 300, 'O texto')
  db.prepare('UPDATE professionals SET about = ? WHERE id = ?').run(about, pro.id)
  return { about }
})

route('POST', '/api/prestador/publicar', 'user', ({ db, viewer, body }) => {
  const pro = ownProfessional(db, viewer)
  if (pro.status === 'publicado') throw new HttpError(409, 'Seu perfil já está publicado.')

  // Os mesmos requisitos do cartão "Publicar", conferidos aqui
  const missing: Record<string, string> = {}
  if (!pro.photo_id) missing.photo = 'Adicione uma foto no Perfil.'
  if (!pro.whatsapp) missing.phone = 'Cadastre seu WhatsApp no Perfil.'
  const { total } = db.prepare('SELECT count(*) AS total FROM services WHERE professional_id = ?').get(pro.id) as {
    total: number
  }
  if (total === 0) missing.services = 'Cadastre pelo menos um serviço.'
  if (Object.keys(missing).length > 0) {
    throw new HttpError(400, 'Falta completar o perfil antes de publicar.', missing)
  }

  const settings = loadSettings(db)
  const plan = body.plan
  if (plan !== 'mensal' && plan !== 'semestral') fieldError('plan', 'Escolha um plano.')
  const method = body.method
  const enabled = (method === 'pix' && settings.pixEnabled) || (method === 'cartao' && settings.cardEnabled)
  if (!enabled) fieldError('method', 'Escolha uma forma de pagamento disponível.')

  // TODO: criar a assinatura no gateway antes de publicar
  const trialEndsAt = trialEndDate(settings)
  db.prepare(
    `UPDATE professionals SET status = 'publicado', plan = ?, payment_method = ?, trial_ends_at = ? WHERE id = ?`,
  ).run(plan, method, trialEndsAt, pro.id)
  return { status: 'publicado', plan, trialEndsAt }
})

route('GET', '/api/prestador/contatos', 'user', ({ db, viewer }) => {
  const pro = ownProfessional(db, viewer)
  const rows = db
    .prepare(
      `SELECT id, professional_id AS professionalId, client, task, message, neighborhood, date, answered
       FROM contacts WHERE professional_id = ? ORDER BY date DESC`,
    )
    .all(pro.id) as { answered: number }[]
  return rows.map((row) => ({ ...row, answered: row.answered === 1 }))
})

route('PATCH', '/api/prestador/contatos/:id', 'user', ({ db, viewer, params }) => {
  const pro = ownProfessional(db, viewer)
  // Só marca contatos do próprio prestador
  const result = db
    .prepare('UPDATE contacts SET answered = 1 WHERE id = ? AND professional_id = ?')
    .run(params.id, pro.id)
  if (result.changes === 0) throw new HttpError(404, 'Contato não encontrado.')
  return { answered: true }
})

// ---------- catálogo ----------

type ProfessionRow = { id: string; name: string; tasks: string; image_id: string | null }

const professionJson = (row: ProfessionRow) => ({
  id: row.id,
  name: row.name,
  tasks: JSON.parse(row.tasks) as string[],
  image: photoUrl(row.image_id),
})

route('GET', '/api/catalogo', 'public', ({ db }) =>
  (db.prepare('SELECT * FROM professions ORDER BY position').all() as ProfessionRow[]).map(professionJson),
)

function slug(text: string) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

route('POST', '/api/catalogo', 'admin', ({ db, body }) => {
  const name = collapse(text(body, 'name', 40, 'O nome'))
  if (!name) fieldError('name', 'Informe o nome da modalidade.')
  if (!isValidName(name)) fieldError('name', 'Use só letras no nome da modalidade, sem números ou símbolos.')
  const existing = db.prepare('SELECT name FROM professions').all() as { name: string }[]
  if (existing.some((p) => normalize(p.name) === normalize(name))) {
    fieldError('name', 'Já existe uma modalidade com esse nome.', 409)
  }

  if (!Array.isArray(body.tasks)) fieldError('tasks', 'Informe pelo menos um serviço, para a modalidade aparecer na busca.')
  const tasks = (body.tasks as unknown[])
    .map((task) => (typeof task === 'string' ? collapse(task.trim()) : ''))
    .filter(Boolean)
  if (tasks.length === 0) fieldError('tasks', 'Informe pelo menos um serviço, para a modalidade aparecer na busca.')
  if (tasks.length > 30) fieldError('tasks', 'Informe até 30 serviços.')
  if (tasks.some((task) => task.length > 60)) fieldError('tasks', 'Cada serviço pode ter até 60 caracteres.')

  const image = body.image ? parseImage(body.image, 'image') : undefined

  const base = slug(name) || 'modalidade'
  let id = base
  for (let n = 2; db.prepare('SELECT 1 FROM professions WHERE id = ?').get(id); n++) id = `${base}-${n}`

  transaction(db, () => {
    const imageId = image ? savePhoto(db, image) : null
    const { next } = db.prepare('SELECT coalesce(max(position), -1) + 1 AS next FROM professions').get() as {
      next: number
    }
    db.prepare('INSERT INTO professions (id, name, tasks, image_id, position) VALUES (?, ?, ?, ?, ?)').run(
      id,
      name,
      JSON.stringify(tasks),
      imageId,
      next,
    )
  })
  return professionJson(db.prepare('SELECT * FROM professions WHERE id = ?').get(id) as ProfessionRow)
})

// Os serviços da modalidade saem junto (ON DELETE CASCADE)
route('DELETE', '/api/catalogo/:id', 'admin', ({ db, params }) => {
  const result = db.prepare('DELETE FROM professions WHERE id = ?').run(params.id)
  if (result.changes === 0) throw new HttpError(404, 'Modalidade não encontrada.')
})

// ---------- plano ----------

function loadSettings(db: Db): PlanSettings {
  const row = db.prepare('SELECT * FROM plan_settings WHERE id = 1').get() as {
    monthly_price: number
    semiannual_price: number
    trial_days: number
    gateway: PlanSettings['gateway']
    pix_enabled: number
    card_enabled: number
  }
  return {
    monthlyPrice: row.monthly_price,
    semiannualPrice: row.semiannual_price,
    trialDays: row.trial_days,
    gateway: row.gateway,
    pixEnabled: row.pix_enabled === 1,
    cardEnabled: row.card_enabled === 1,
  }
}

route('GET', '/api/plano', 'public', ({ db }) => loadSettings(db))

route('PUT', '/api/plano', 'admin', ({ db, body }) => {
  const price = (field: string) => {
    const value = body[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10000) {
      fieldError(field, 'Informe os preços em reais, por exemplo 19,90.')
    }
    return Math.round(value * 100) / 100
  }
  const monthlyPrice = price('monthlyPrice')
  const semiannualPrice = price('semiannualPrice')
  const trialDays = body.trialDays
  if (!Number.isInteger(trialDays) || (trialDays as number) < 0 || (trialDays as number) > 90) {
    fieldError('trialDays', 'O período grátis precisa ser de 0 a 90 dias.')
  }
  const gateway = body.gateway
  if (!gateways.some((g) => g.id === gateway)) fieldError('gateway', 'Escolha um gateway da lista.')
  const pixEnabled = body.pixEnabled === true
  const cardEnabled = body.cardEnabled === true
  if (!pixEnabled && !cardEnabled) fieldError('methods', 'Deixe pelo menos uma forma de pagamento ligada.')

  db.prepare(
    `UPDATE plan_settings SET monthly_price = ?, semiannual_price = ?, trial_days = ?, gateway = ?,
     pix_enabled = ?, card_enabled = ? WHERE id = 1`,
  ).run(monthlyPrice, semiannualPrice, trialDays as number, gateway as string, pixEnabled ? 1 : 0, cardEnabled ? 1 : 0)
  return loadSettings(db)
})

// ---------- administração ----------

route('GET', '/api/admin/estatisticas', 'admin', ({ db }) => {
  const settings = loadSettings(db)
  const today = isoDate(new Date())
  const count = (sql: string, ...args: (string | number)[]) =>
    (db.prepare(sql).get(...args) as { total: number }).total

  const accounts = count('SELECT count(*) AS total FROM accounts WHERE is_admin = 0')
  const providers = count('SELECT count(*) AS total FROM professionals')
  const published = db
    .prepare(`SELECT plan, trial_ends_at FROM professionals WHERE status = 'publicado'`)
    .all() as { plan: PlanId | null; trial_ends_at: string | null }[]
  const inTrial = published.filter((p) => p.trial_ends_at && p.trial_ends_at > today)
  const paying = published.filter((p) => !(p.trial_ends_at && p.trial_ends_at > today))

  const ranking = (
    db
      .prepare(
        `SELECT pr.id, pr.name, count(s.id) AS services, count(DISTINCT s.professional_id) AS providers
         FROM professions pr LEFT JOIN services s ON s.profession_id = pr.id
         GROUP BY pr.id ORDER BY services DESC, pr.position`,
      )
      .all() as { id: string; name: string; services: number; providers: number }[]
  ).map((row) => ({ professionId: row.id, name: row.name, services: row.services, providers: row.providers }))

  return {
    stats: {
      accounts,
      // Prestadores de exemplo não têm conta de login; contam como cadastrados
      people: accounts + count('SELECT count(*) AS total FROM professionals WHERE account_id IS NULL'),
      consumersOnly: count(
        `SELECT count(*) AS total FROM accounts a WHERE is_admin = 0
         AND NOT EXISTS (SELECT 1 FROM professionals p WHERE p.account_id = a.id)`,
      ),
      providers,
      published: published.length,
      drafts: providers - published.length,
      inTrial: inTrial.length,
      paying: paying.length,
      services: count('SELECT count(*) AS total FROM services'),
      modalities: count('SELECT count(*) AS total FROM professions'),
      contacts: count('SELECT count(*) AS total FROM contacts'),
      reviews: count('SELECT count(*) AS total FROM reviews'),
      // Receita mensal recorrente: planos semestrais entram pelo valor equivalente por mês
      monthlyRevenue: paying.reduce(
        (total, p) => total + monthlyValue(findPlan(settings, p.plan ?? 'mensal')),
        0,
      ),
    },
    ranking,
  }
})
