// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { isoDate } from '../src/features/conta/plano.ts'
import { startTestServer, type TestServer } from './test-server.ts'
import { readyProvider, signIn, signUp, VALID_CPFS } from './helpers.test-utils.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
beforeEach(() => server.reset())
afterAll(() => server.close())

const row = (sql: string, ...args: string[]) => server.db.prepare(sql).get(...args) as Record<string, unknown>
const search = (token?: string) =>
  server.request('GET', '/api/prestadores?profissao=eletricista&servico=Instalar%20chuveiro', undefined, token)

describe('Busca de prestadores', () => {
  it('sem login: só o primeiro nome, sem foto, preço e WhatsApp (nada disso sai do servidor)', async () => {
    server.db.prepare(`INSERT INTO photos (id, mime, data) VALUES ('f1', 'image/png', x'00')`).run()
    server.db.prepare(`UPDATE professionals SET whatsapp = '62988887777', photo_id = 'f1' WHERE id = 'p1'`).run()
    const { body } = await search()
    const carlos = body.find((p: { id: string }) => p.id === 'p1')
    expect(carlos.name).toBe('Carlos')
    expect(carlos.photo).toBeUndefined()
    expect(carlos.whatsapp).toBeUndefined()
    expect(carlos.reviews).toBeGreaterThan(0)
    // A unidade não é sigilosa: vem mesmo com o preço escondido
    expect(carlos.services[0]).toEqual({
      professionId: 'eletricista',
      name: 'Instalar chuveiro',
      price: null,
      unit: 'servico',
      hidden: true,
    })
    expect(JSON.stringify(body)).not.toMatch(/Henrique|62988887777/)
  })

  it('com login: nome completo, foto, preço e WhatsApp', async () => {
    server.db.prepare(`INSERT INTO photos (id, mime, data) VALUES ('f1', 'image/png', x'00')`).run()
    server.db.prepare(`UPDATE professionals SET whatsapp = '62988887777', photo_id = 'f1' WHERE id = 'p1'`).run()
    const token = await signIn(server, 'beatriz@exemplo.com')
    const carlos = (await search(token)).body.find((p: { id: string }) => p.id === 'p1')
    expect(carlos).toMatchObject({ name: 'Carlos Henrique', photo: '/api/fotos/f1', whatsapp: '62988887777' })
    expect(carlos.services[0].price).toBe(150)
  })

  it('serviço "a combinar" não aparece como escondido', async () => {
    const rafael = (await search()).body.find((p: { id: string }) => p.id === 'p3')
    expect(rafael.services[0]).toEqual({ professionId: 'eletricista', name: 'Instalar chuveiro', price: null, unit: 'servico' })
  })

  it('ordena pela reputação (poucas avaliações não passam na frente)', async () => {
    const ids = (await search()).body.map((p: { id: string }) => p.id)
    expect(ids).toEqual(['p1', 'p2', 'p3'])
  })

  it('rascunho não aparece na busca nem no perfil público, só para o dono', async () => {
    const { token, account } = await signUp(server, { asProvider: true, cpf: VALID_CPFS[0] })
    await server.request(
      'PUT',
      '/api/prestador/servicos',
      { services: [{ professionId: 'eletricista', name: 'Instalar chuveiro', price: 90 }] },
      token,
    )
    expect((await search()).body.map((p: { id: string }) => p.id)).not.toContain(account.professionalId)
    expect((await server.request('GET', `/api/prestadores/${account.professionalId}`)).status).toBe(404)
    const other = await signIn(server, 'beatriz@exemplo.com')
    expect((await server.request('GET', `/api/prestadores/${account.professionalId}`, undefined, other)).status).toBe(404)
    expect((await server.request('GET', `/api/prestadores/${account.professionalId}`, undefined, token)).status).toBe(200)
  })

  it('perfil público traz as avaliações', async () => {
    const reviews = await server.request('GET', '/api/prestadores/p1/avaliacoes')
    expect(reviews.body).toHaveLength(4)
    expect(reviews.body[0]).toMatchObject({ author: 'Fernanda', rating: 5 })
  })
})

describe('Meus serviços: gravação', () => {
  it('grava como o preço é cobrado; sem unidade, fica por serviço', async () => {
    const { token, account } = await signUp(server, { asProvider: true, cpf: VALID_CPFS[0] })
    await server.request(
      'PUT',
      '/api/prestador/servicos',
      {
        services: [
          { professionId: 'pedreiro', name: 'Assentar piso', price: 45, unit: 'm2' },
          { professionId: 'pedreiro', name: 'Reboco', price: 250, unit: 'diaria' },
          { professionId: 'pintor', name: 'Pintar portão', price: null },
        ],
      },
      token,
    )
    const units = server.db
      .prepare('SELECT unit FROM services WHERE professional_id = ? ORDER BY position')
      .all(account.professionalId!)
      .map((r) => (r as { unit: string }).unit)
    expect(units).toEqual(['m2', 'diaria', 'servico'])
  })

  it('grava os serviços na ordem, com preço inteiro ou a combinar', async () => {
    const { token, account } = await signUp(server, { asProvider: true, cpf: VALID_CPFS[0] })
    const response = await server.request(
      'PUT',
      '/api/prestador/servicos',
      {
        services: [
          { professionId: 'eletricista', name: '  Instalar   ventilador ', price: 120 },
          { professionId: 'pintor', name: 'Pintar portão', price: null },
        ],
      },
      token,
    )
    expect(response.status).toBe(200)
    const saved = server.db
      .prepare('SELECT profession_id, name, price, position FROM services WHERE professional_id = ? ORDER BY position')
      .all(account.professionalId!)
    expect(saved).toEqual([
      { profession_id: 'eletricista', name: 'Instalar ventilador', price: 120, position: 0 },
      { profession_id: 'pintor', name: 'Pintar portão', price: null, position: 1 },
    ])
  })

  it('substitui a lista inteira (apagar um serviço some do banco)', async () => {
    const { token, account } = await readyProvider(server)
    await server.request('PUT', '/api/prestador/servicos', { services: [] }, token)
    expect(row('SELECT count(*) AS n FROM services WHERE professional_id = ?', account.professionalId!).n).toBe(0)
  })

  it.each([
    ['profissão que não existe', { professionId: 'astronauta', name: 'Voar', price: 1 }, 'professionId'],
    ['nome vazio', { professionId: 'eletricista', name: '  ', price: 1 }, 'name'],
    ['nome com mais de 60 letras', { professionId: 'eletricista', name: 'x'.repeat(61), price: 1 }, 'name'],
    ['preço negativo', { professionId: 'eletricista', name: 'A', price: -5 }, 'price'],
    ['preço com centavos', { professionId: 'eletricista', name: 'A', price: 10.5 }, 'price'],
    ['preço em texto', { professionId: 'eletricista', name: 'A', price: '100' }, 'price'],
    ['preço acima do limite', { professionId: 'eletricista', name: 'A', price: 1000000 }, 'price'],
    ['unidade que não existe', { professionId: 'eletricista', name: 'A', price: 1, unit: 'semana' }, 'unit'],
  ])('recusa %s e mantém a lista anterior', async (_, service, field) => {
    const { token, account } = await readyProvider(server)
    const response = await server.request('PUT', '/api/prestador/servicos', { services: [service] }, token)
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toBeDefined()
    expect(row('SELECT count(*) AS n FROM services WHERE professional_id = ?', account.professionalId!).n).toBe(1)
  })

  it('recusa serviço repetido na mesma profissão, sem diferenciar maiúsculas e acentos', async () => {
    const { token } = await readyProvider(server)
    const response = await server.request(
      'PUT',
      '/api/prestador/servicos',
      {
        services: [
          { professionId: 'pintor', name: 'Pintar portão', price: 1 },
          { professionId: 'pintor', name: 'PINTAR PORTAO', price: 2 },
        ],
      },
      token,
    )
    expect(response.status).toBe(400)
    expect(response.body.fields.name).toMatch(/já tem um serviço/)
  })

  it('aceita o mesmo nome em profissões diferentes', async () => {
    const { token } = await readyProvider(server)
    const response = await server.request(
      'PUT',
      '/api/prestador/servicos',
      {
        services: [
          { professionId: 'pintor', name: 'Orçamento', price: null },
          { professionId: 'pedreiro', name: 'Orçamento', price: null },
        ],
      },
      token,
    )
    expect(response.status).toBe(200)
  })

  it('grava o texto "Sobre" e recusa acima de 300 caracteres', async () => {
    const { token, account } = await readyProvider(server)
    await server.request('PATCH', '/api/prestador/sobre', { about: '  Atendo a região sul.  ' }, token)
    expect(row('SELECT about FROM professionals WHERE id = ?', account.professionalId!).about).toBe('Atendo a região sul.')
    expect((await server.request('PATCH', '/api/prestador/sobre', { about: 'x'.repeat(301) }, token)).status).toBe(400)
  })

  it('quem só contrata não tem área de prestador', async () => {
    const token = await signIn(server, 'beatriz@exemplo.com')
    expect((await server.request('GET', '/api/prestador', undefined, token)).status).toBe(403)
    expect((await server.request('PUT', '/api/prestador/servicos', { services: [] }, token)).status).toBe(403)
  })
})

describe('Publicar perfil', () => {
  it('lista o que falta: foto, WhatsApp e serviço', async () => {
    const { token } = await signUp(server, { asProvider: true, cpf: VALID_CPFS[0] })
    const response = await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.fields).sort()).toEqual(['phone', 'photo', 'services'])
  })

  it('administração publica sem plano nem pagamento; os demais precisam escolher', async () => {
    const { token, account } = await readyProvider(server)
    const semPlano = await server.request('POST', '/api/prestador/publicar', {}, token)
    expect(semPlano.status).toBe(400)
    expect(semPlano.body.fields.plan).toBeDefined()

    server.db.prepare('UPDATE accounts SET is_admin = 1 WHERE id = ?').run(account.id)
    const response = await server.request('POST', '/api/prestador/publicar', {}, token)
    expect(response.status).toBe(200)
    expect(
      row('SELECT status, plan, payment_method, trial_ends_at FROM professionals WHERE id = ?', account.professionalId!),
    ).toEqual({ status: 'publicado', plan: null, payment_method: null, trial_ends_at: null })
  })

  it('publica e grava plano, forma de pagamento e fim do período grátis', async () => {
    const { token, account } = await readyProvider(server)
    const response = await server.request('POST', '/api/prestador/publicar', { plan: 'semestral', method: 'cartao' }, token)
    expect(response.status).toBe(200)

    const expected = new Date()
    expected.setDate(expected.getDate() + 15)
    expect(row('SELECT * FROM professionals WHERE id = ?', account.professionalId!)).toMatchObject({
      status: 'publicado',
      plan: 'semestral',
      payment_method: 'cartao',
      trial_ends_at: isoDate(expected),
    })
    // Publicado, aparece na busca
    expect((await search()).body.map((p: { id: string }) => p.id)).toContain(account.professionalId)
  })

  it('não publica duas vezes', async () => {
    const { token } = await readyProvider(server)
    await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)
    expect((await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)).status).toBe(409)
  })

  it('recusa plano inválido e forma de pagamento desligada', async () => {
    const { token } = await readyProvider(server)
    expect((await server.request('POST', '/api/prestador/publicar', { plan: 'anual', method: 'pix' }, token)).body.fields.plan).toBeDefined()
    server.db.prepare('UPDATE plan_settings SET pix_enabled = 0').run()
    expect((await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)).body.fields.method).toBeDefined()
  })
})

describe('Contatos do prestador', () => {
  it('lista os contatos e grava "respondido"', async () => {
    const token = await signIn(server, 'carlos@exemplo.com')
    const list = await server.request('GET', '/api/prestador/contatos', undefined, token)
    expect(list.body).toHaveLength(4)
    expect(list.body.filter((c: { answered: boolean }) => !c.answered)).toHaveLength(2)

    await server.request('PATCH', '/api/prestador/contatos/c1', {}, token)
    expect(row(`SELECT answered FROM contacts WHERE id = 'c1'`).answered).toBe(1)
  })

  it('não marca contato de outro prestador', async () => {
    const { token } = await readyProvider(server)
    expect((await server.request('PATCH', '/api/prestador/contatos/c1', {}, token)).status).toBe(404)
    expect(row(`SELECT answered FROM contacts WHERE id = 'c1'`).answered).toBe(0)
  })
})
