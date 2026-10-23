// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from './test-server.ts'
import { PNG_1PX, readyProvider, signIn } from './helpers.test-utils.ts'

let server: TestServer
let admin: string
beforeAll(async () => {
  server = await startTestServer()
})
beforeEach(async () => {
  await server.reset()
  admin = await signIn(server, 'admin@exemplo.com')
})
afterAll(() => server.close())

const row = (sql: string, ...args: string[]) => server.db.prepare(sql).get(...args) as Record<string, unknown>

describe('Administração: permissões conferidas no servidor', () => {
  it.each([
    ['POST', '/api/catalogo'],
    ['DELETE', '/api/catalogo/eletricista'],
    ['PUT', '/api/plano'],
    ['GET', '/api/admin/estatisticas'],
  ])('%s %s: 401 sem login e 403 para quem não é admin', async (method, path) => {
    const body = method === 'GET' || method === 'DELETE' ? undefined : {}
    expect((await server.request(method, path, body)).status).toBe(401)
    const user = await signIn(server, 'carlos@exemplo.com')
    expect((await server.request(method, path, body, user)).status).toBe(403)
  })

  it('a modalidade continua lá depois da tentativa sem permissão', async () => {
    const user = await signIn(server, 'beatriz@exemplo.com')
    await server.request('DELETE', '/api/catalogo/eletricista', undefined, user)
    expect(row(`SELECT count(*) AS n FROM professions WHERE id = 'eletricista'`).n).toBe(1)
  })
})

describe('Administração: modalidades', () => {
  it('cria a modalidade e grava nome, id, serviços e posição', async () => {
    const response = await server.request(
      'POST',
      '/api/catalogo',
      { name: ' Técnico de Ar-condicionado ', tasks: [' Limpar ar ', '', 'Instalar  split'] },
      admin,
    )
    expect(response.status).toBe(200)
    expect(row(`SELECT * FROM professions WHERE id = 'tecnico-de-ar-condicionado'`)).toMatchObject({
      name: 'Técnico de Ar-condicionado',
      tasks: JSON.stringify(['Limpar ar', 'Instalar split']),
      position: 9,
      image_id: null,
    })
  })

  it('grava a imagem enviada (PNG) e recusa SVG', async () => {
    const ok = await server.request('POST', '/api/catalogo', { name: 'Vidraceiro', tasks: ['Trocar vidro'], image: PNG_1PX }, admin)
    expect(ok.body.image).toMatch(/^\/api\/fotos\//)
    const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64')
    const refused = await server.request('POST', '/api/catalogo', { name: 'Serralheiro', tasks: ['Portão'], image: svg }, admin)
    expect(refused.status).toBe(400)
  })

  it.each([
    ['nome vazio', { name: '', tasks: ['A'] }, 400, 'name'],
    ['nome com número', { name: 'Pedreiro 2', tasks: ['A'] }, 400, 'name'],
    ['nome repetido (sem acento/maiúscula)', { name: 'ELETRICISTA', tasks: ['A'] }, 409, 'name'],
    ['sem serviços', { name: 'Vidraceiro', tasks: ['  '] }, 400, 'tasks'],
    ['serviços em formato errado', { name: 'Vidraceiro', tasks: 'Trocar vidro' }, 400, 'tasks'],
  ])('recusa %s', async (_, body, status, field) => {
    const response = await server.request('POST', '/api/catalogo', body, admin)
    expect(response.status).toBe(status)
    expect(response.body.fields[field]).toBeDefined()
    expect(row('SELECT count(*) AS n FROM professions').n).toBe(9)
  })

  it('remover a modalidade apaga os serviços dela de todos os perfis', async () => {
    expect(row(`SELECT count(*) AS n FROM services WHERE profession_id = 'eletricista'`).n).toBeGreaterThan(0)
    expect((await server.request('DELETE', '/api/catalogo/eletricista', undefined, admin)).status).toBe(204)
    expect(row(`SELECT count(*) AS n FROM services WHERE profession_id = 'eletricista'`).n).toBe(0)
    expect((await server.request('DELETE', '/api/catalogo/eletricista', undefined, admin)).status).toBe(404)
  })
})

describe('Administração: plano', () => {
  it('grava os novos valores e todo mundo passa a ver', async () => {
    const response = await server.request(
      'PUT',
      '/api/plano',
      { monthlyPrice: 25, semiannualPrice: 120.456, trialDays: 30, gateway: 'stripe', pixEnabled: false, cardEnabled: true },
      admin,
    )
    expect(response.status).toBe(200)
    expect(row('SELECT * FROM plan_settings')).toMatchObject({
      monthly_price: 25,
      semiannual_price: 120.46,
      trial_days: 30,
      gateway: 'stripe',
      pix_enabled: 0,
      card_enabled: 1,
    })
    expect((await server.request('GET', '/api/plano')).body).toMatchObject({ monthlyPrice: 25, trialDays: 30 })
  })

  it('o novo período grátis vale para quem publicar depois', async () => {
    await server.request(
      'PUT',
      '/api/plano',
      { monthlyPrice: 19.9, semiannualPrice: 99.9, trialDays: 0, gateway: 'mercadopago', pixEnabled: true, cardEnabled: true },
      admin,
    )
    const { token, account } = await readyProvider(server)
    await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)
    const pro = row('SELECT trial_ends_at FROM professionals WHERE id = ?', account.professionalId!)
    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(pro.trial_ends_at).toBe(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`)
  })

  it.each([
    ['preço zero', { monthlyPrice: 0 }, 'monthlyPrice'],
    ['preço em texto', { monthlyPrice: '19,90' }, 'monthlyPrice'],
    ['período grátis acima de 90', { trialDays: 91 }, 'trialDays'],
    ['período grátis quebrado', { trialDays: 1.5 }, 'trialDays'],
    ['gateway fora da lista', { gateway: 'paypal' }, 'gateway'],
    ['sem forma de pagamento', { pixEnabled: false, cardEnabled: false }, 'methods'],
  ])('recusa %s', async (_, change, field) => {
    const response = await server.request(
      'PUT',
      '/api/plano',
      { monthlyPrice: 19.9, semiannualPrice: 99.9, trialDays: 15, gateway: 'mercadopago', pixEnabled: true, cardEnabled: true, ...change },
      admin,
    )
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toBeDefined()
    expect(row('SELECT monthly_price, trial_days FROM plan_settings')).toEqual({ monthly_price: 19.9, trial_days: 15 })
  })
})

describe('Administração: painel', () => {
  it('conta os números a partir do banco', async () => {
    const { stats, ranking } = (await server.request('GET', '/api/admin/estatisticas', undefined, admin)).body
    expect(stats).toMatchObject({
      accounts: 2,
      consumersOnly: 1,
      providers: 24,
      published: 24,
      drafts: 0,
      inTrial: 0,
      paying: 24,
      modalities: 9,
      contacts: 4,
      reviews: 7,
    })
    expect(stats.people).toBe(2 + 23)
    expect(stats.monthlyRevenue).toBeCloseTo(24 * 19.9)
    expect(ranking.map((r: { services: number }) => r.services)).toEqual(
      [...ranking.map((r: { services: number }) => r.services)].sort((a, b) => b - a),
    )
  })

  it('acompanha um prestador novo no período grátis', async () => {
    const { token } = await readyProvider(server)
    await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)
    const { stats } = (await server.request('GET', '/api/admin/estatisticas', undefined, admin)).body
    expect(stats).toMatchObject({ accounts: 3, providers: 25, published: 25, inTrial: 1, paying: 24 })
  })
})
