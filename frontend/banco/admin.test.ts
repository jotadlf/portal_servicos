// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, exec, PNG_1PX, readyProvider, resetDb, row, signIn, todayInBrazil } from './ajuda.ts'

let admin: SupabaseClient
beforeEach(async () => {
  await resetDb()
  admin = await signIn('admin@exemplo.com')
})
afterAll(closeDb)

// Imagem enviada pela administração para uma modalidade nova
async function uploadModalityImage(data = PNG_1PX, type = 'image/png') {
  const path = `modalidades/${crypto.randomUUID()}.png`
  const { error } = await admin.storage.from('fotos').upload(path, data, { contentType: type })
  return { path, error }
}

describe('Administração: permissões conferidas no banco', () => {
  it.each(['adicionar_modalidade', 'remover_modalidade', 'salvar_plano', 'estatisticas'])(
    '%s: 401 sem login e 403 para quem não é admin',
    async (fn) => {
      expect((await call(fn, {})).status).toBe(401)
      const user = await signIn('carlos@exemplo.com')
      expect((await call(fn, {}, user)).status).toBe(403)
    },
  )

  it('a modalidade continua lá depois da tentativa sem permissão', async () => {
    const user = await signIn('beatriz@exemplo.com')
    await call('remover_modalidade', { id: 'eletricista' }, user)
    expect((await row(`select count(*) as n from public.professions where id = 'eletricista'`))!.n).toBe(1)
  })

  it('quem não é admin não envia imagem de modalidade', async () => {
    const user = await signIn('carlos@exemplo.com')
    const { error } = await user.storage
      .from('fotos')
      .upload(`modalidades/${crypto.randomUUID()}.png`, PNG_1PX, { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
})

describe('Administração: modalidades', () => {
  it('cria a modalidade e grava nome, id, serviços e posição', async () => {
    const response = await call(
      'adicionar_modalidade',
      { name: ' Técnico de Ar-condicionado ', tasks: [' Limpar ar ', '', 'Instalar  split'] },
      admin,
    )
    expect(response.status).toBe(200)
    expect(await row(`select * from public.professions where id = 'tecnico-de-ar-condicionado'`)).toMatchObject({
      name: 'Técnico de Ar-condicionado',
      tasks: ['Limpar ar', 'Instalar split'],
      position: 9,
      image: null,
    })
  })

  it('grava a imagem enviada (PNG); o Storage recusa SVG', async () => {
    const { path } = await uploadModalityImage()
    const ok = await call('adicionar_modalidade', { name: 'Vidraceiro', tasks: ['Trocar vidro'], image: path }, admin)
    expect(ok.body.image).toBe(path)

    const svg = await uploadModalityImage(Buffer.from('<svg/>'), 'image/svg+xml')
    expect(svg.error).not.toBeNull()
    const refused = await call('adicionar_modalidade', { name: 'Serralheiro', tasks: ['Portão'], image: svg.path }, admin)
    expect(refused.status).toBe(400)
  })

  it.each([
    ['nome vazio', { name: '', tasks: ['A'] }, 400, 'name'],
    ['nome com número', { name: 'Pedreiro 2', tasks: ['A'] }, 400, 'name'],
    ['nome repetido (sem acento/maiúscula)', { name: 'ELETRICISTA', tasks: ['A'] }, 409, 'name'],
    ['sem serviços', { name: 'Vidraceiro', tasks: ['  '] }, 400, 'tasks'],
    ['serviços em formato errado', { name: 'Vidraceiro', tasks: 'Trocar vidro' }, 400, 'tasks'],
  ])('recusa %s', async (_, body, status, field) => {
    const response = await call('adicionar_modalidade', body, admin)
    expect(response.status).toBe(status)
    expect(response.body.fields[field]).toBeDefined()
    expect((await row('select count(*) as n from public.professions'))!.n).toBe(9)
  })

  it('remover a modalidade apaga os serviços dela de todos os perfis', async () => {
    expect((await row(`select count(*) as n from public.services where profession_id = 'eletricista'`))!.n).toBeGreaterThan(0)
    expect((await call('remover_modalidade', { id: 'eletricista' }, admin)).status).toBe(200)
    expect((await row(`select count(*) as n from public.services where profession_id = 'eletricista'`))!.n).toBe(0)
    expect((await call('remover_modalidade', { id: 'eletricista' }, admin)).status).toBe(404)
  })
})

describe('Administração: plano', () => {
  it('grava os novos valores e todo mundo passa a ver', async () => {
    const response = await call(
      'salvar_plano',
      { monthlyPrice: 25, semiannualPrice: 120.456, trialDays: 30, gateway: 'stripe', pixEnabled: false, cardEnabled: true },
      admin,
    )
    expect(response.status).toBe(200)
    expect(await row('select * from public.plan_settings')).toMatchObject({
      monthly_price: 25,
      semiannual_price: 120.46,
      trial_days: 30,
      gateway: 'stripe',
      pix_enabled: false,
      card_enabled: true,
    })
    expect((await call('plano')).body).toMatchObject({ monthlyPrice: 25, trialDays: 30 })
  })

  it('o novo período grátis vale para quem publicar depois', async () => {
    await call(
      'salvar_plano',
      { monthlyPrice: 19.9, semiannualPrice: 99.9, trialDays: 0, gateway: 'mercadopago', pixEnabled: true, cardEnabled: true },
      admin,
    )
    const { client, account } = await readyProvider()
    await call('publicar', { plan: 'mensal', method: 'pix' }, client)
    const pro = await row('select trial_ends_at from public.professionals where id = $1', account.professionalId)
    expect(pro!.trial_ends_at).toBe(todayInBrazil())
  })

  it.each([
    ['preço zero', { monthlyPrice: 0 }, 'monthlyPrice'],
    ['preço em texto', { monthlyPrice: '19,90' }, 'monthlyPrice'],
    ['período grátis acima de 90', { trialDays: 91 }, 'trialDays'],
    ['período grátis quebrado', { trialDays: 1.5 }, 'trialDays'],
    ['gateway fora da lista', { gateway: 'paypal' }, 'gateway'],
    ['sem forma de pagamento', { pixEnabled: false, cardEnabled: false }, 'methods'],
  ])('recusa %s', async (_, change, field) => {
    const response = await call(
      'salvar_plano',
      { monthlyPrice: 19.9, semiannualPrice: 99.9, trialDays: 15, gateway: 'mercadopago', pixEnabled: true, cardEnabled: true, ...change },
      admin,
    )
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toBeDefined()
    expect(await row('select monthly_price, trial_days from public.plan_settings')).toEqual({ monthly_price: 19.9, trial_days: 15 })
  })
})

describe('Administração: painel', () => {
  it('conta os números a partir do banco', async () => {
    const { stats, ranking } = (await call('estatisticas', undefined, admin)).body
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
    const { client } = await readyProvider()
    await call('publicar', { plan: 'mensal', method: 'pix' }, client)
    const { stats } = (await call('estatisticas', undefined, admin)).body
    expect(stats).toMatchObject({ accounts: 3, providers: 25, published: 25, inTrial: 1, paying: 24 })
  })

  it('perfil da administração conta como publicado, mas não como pagante nem na receita', async () => {
    const before = (await call('estatisticas', undefined, admin)).body.stats
    const { client, account } = await readyProvider()
    await exec('update public.profiles set is_admin = true where id = $1', account.id)
    await call('publicar', {}, client)

    const { stats } = (await call('estatisticas', undefined, admin)).body
    expect(stats.published).toBe(before.published + 1)
    expect(stats).toMatchObject({ inTrial: before.inTrial, paying: before.paying, monthlyRevenue: before.monthlyRevenue })
  })
})
