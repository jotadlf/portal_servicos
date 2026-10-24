// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, exec, readyProvider, resetDb, row, rows, signIn, signUp, todayInBrazil, VALID_CPFS } from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

const search = (client?: Awaited<ReturnType<typeof signIn>>) =>
  call('prestadores', { profissao: 'eletricista', servico: 'Instalar chuveiro' }, client)

describe('Busca de prestadores', () => {
  it('sem login: só o primeiro nome, sem foto, preço e WhatsApp (nada disso sai do banco)', async () => {
    await exec(`update public.prestadores set whatsapp = '62988887777' where id = 'p1'`)
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
    expect(JSON.stringify(body)).not.toMatch(/Henrique|62988887777|exemplos\//)
  })

  it('com login: nome completo, foto, preço e WhatsApp', async () => {
    await exec(`update public.prestadores set whatsapp = '62988887777' where id = 'p1'`)
    const client = await signIn('beatriz@exemplo.com')
    const carlos = (await search(client)).body.find((p: { id: string }) => p.id === 'p1')
    expect(carlos).toMatchObject({ name: 'Carlos Henrique', photo: 'exemplos/p1.png', whatsapp: '62988887777' })
    expect(carlos.services[0].price).toBe(150)
  })

  it('serviço "a combinar" não aparece como escondido', async () => {
    const rafael = (await search()).body.find((p: { id: string }) => p.id === 'p3')
    expect(rafael.services[0]).toEqual({ professionId: 'eletricista', name: 'Instalar chuveiro', price: null, unit: 'servico' })
  })

  it('ordena pela reputação (poucas avaliações não passam na frente)', async () => {
    expect((await search()).body.map((p: { id: string }) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('rascunho não aparece na busca nem no perfil público, só para o dono', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    await call(
      'salvar_servicos',
      { services: [{ professionId: 'eletricista', name: 'Instalar chuveiro', price: 90 }] },
      client,
    )
    const id = account.professionalId
    expect((await search()).body.map((p: { id: string }) => p.id)).not.toContain(id)
    expect((await call('prestador', { id })).status).toBe(404)
    const other = await signIn('beatriz@exemplo.com')
    expect((await call('prestador', { id }, other)).status).toBe(404)
    expect((await call('prestador', { id }, client)).status).toBe(200)
  })

  it('perfil público traz as avaliações', async () => {
    const reviews = await call('avaliacoes', { id: 'p1' })
    expect(reviews.body).toHaveLength(4)
    expect(reviews.body[0]).toMatchObject({ author: 'Fernanda', rating: 5 })
  })
})

describe('Meus serviços: gravação', () => {
  it('grava como o preço é cobrado; sem unidade, fica por serviço', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    await call(
      'salvar_servicos',
      {
        services: [
          { professionId: 'pedreiro', name: 'Assentar piso', price: 45, unit: 'm2' },
          { professionId: 'pedreiro', name: 'Reboco', price: 250, unit: 'diaria' },
          { professionId: 'pintor', name: 'Pintar portão', price: null },
        ],
      },
      client,
    )
    const units = await rows(
      'select unidade from public.servicos where prestador_id = $1 order by posicao',
      account.professionalId,
    )
    expect(units.map((r) => r.unidade)).toEqual(['m2', 'diaria', 'servico'])
  })

  it('grava os serviços na ordem, com preço inteiro ou a combinar', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const response = await call(
      'salvar_servicos',
      {
        services: [
          { professionId: 'eletricista', name: '  Instalar   ventilador ', price: 120 },
          { professionId: 'pintor', name: 'Pintar portão', price: null },
        ],
      },
      client,
    )
    expect(response.status).toBe(200)
    const saved = await rows(
      'select modalidade_id, nome, preco, posicao from public.servicos where prestador_id = $1 order by posicao',
      account.professionalId,
    )
    expect(saved).toEqual([
      { modalidade_id: 'eletricista', nome: 'Instalar ventilador', preco: 120, posicao: 0 },
      { modalidade_id: 'pintor', nome: 'Pintar portão', preco: null, posicao: 1 },
    ])
  })

  it('substitui a lista inteira (apagar um serviço some do banco)', async () => {
    const { client, account } = await readyProvider()
    await call('salvar_servicos', { services: [] }, client)
    expect((await row('select count(*) as n from public.servicos where prestador_id = $1', account.professionalId))!.n).toBe(0)
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
    const { client, account } = await readyProvider()
    const response = await call('salvar_servicos', { services: [service] }, client)
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toBeDefined()
    expect((await row('select count(*) as n from public.servicos where prestador_id = $1', account.professionalId))!.n).toBe(1)
  })

  it('recusa serviço repetido na mesma profissão, sem diferenciar maiúsculas e acentos', async () => {
    const { client } = await readyProvider()
    const response = await call(
      'salvar_servicos',
      {
        services: [
          { professionId: 'pintor', name: 'Pintar portão', price: 1 },
          { professionId: 'pintor', name: 'PINTAR PORTAO', price: 2 },
        ],
      },
      client,
    )
    expect(response.status).toBe(400)
    expect(response.body.fields.name).toMatch(/já tem um serviço/)
  })

  it('aceita o mesmo nome em profissões diferentes', async () => {
    const { client } = await readyProvider()
    const response = await call(
      'salvar_servicos',
      {
        services: [
          { professionId: 'pintor', name: 'Orçamento', price: null },
          { professionId: 'pedreiro', name: 'Orçamento', price: null },
        ],
      },
      client,
    )
    expect(response.status).toBe(200)
  })

  it('grava o texto "Sobre" e recusa acima de 300 caracteres', async () => {
    const { client, account } = await readyProvider()
    await call('salvar_sobre', { about: '  Atendo a região sul.  ' }, client)
    expect((await row('select sobre from public.prestadores where id = $1', account.professionalId))!.sobre).toBe(
      'Atendo a região sul.',
    )
    expect((await call('salvar_sobre', { about: 'x'.repeat(301) }, client)).status).toBe(400)
  })

  it('quem só contrata não tem área de prestador', async () => {
    const client = await signIn('beatriz@exemplo.com')
    expect((await call('meu_prestador', undefined, client)).status).toBe(403)
    expect((await call('salvar_servicos', { services: [] }, client)).status).toBe(403)
  })
})

describe('Publicar perfil', () => {
  it('lista o que falta: foto, WhatsApp e serviço', async () => {
    const { client } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const response = await call('publicar', { plan: 'mensal', method: 'pix' }, client)
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.fields).sort()).toEqual(['phone', 'photo', 'services'])
  })

  it('administração publica sem plano nem pagamento; os demais precisam escolher', async () => {
    const { client, account } = await readyProvider()
    const semPlano = await call('publicar', {}, client)
    expect(semPlano.status).toBe(400)
    expect(semPlano.body.fields.plan).toBeDefined()

    await exec('update public.contas set admin = true where id = $1', account.id)
    expect((await call('publicar', {}, client)).status).toBe(200)
    expect(
      await row('select status, plano, forma_pagamento, fim_teste from public.prestadores where id = $1', account.professionalId),
    ).toEqual({ status: 'publicado', plano: null, forma_pagamento: null, fim_teste: null })
  })

  it('publica e grava plano, forma de pagamento e fim do período grátis', async () => {
    const { client, account } = await readyProvider()
    expect((await call('publicar', { plan: 'semestral', method: 'cartao' }, client)).status).toBe(200)

    expect(await row('select * from public.prestadores where id = $1', account.professionalId)).toMatchObject({
      status: 'publicado',
      plano: 'semestral',
      forma_pagamento: 'cartao',
      fim_teste: todayInBrazil(15),
    })
    // Publicado, aparece na busca
    expect((await search()).body.map((p: { id: string }) => p.id)).toContain(account.professionalId)
  })

  it('não publica duas vezes', async () => {
    const { client } = await readyProvider()
    await call('publicar', { plan: 'mensal', method: 'pix' }, client)
    expect((await call('publicar', { plan: 'mensal', method: 'pix' }, client)).status).toBe(409)
  })

  it('recusa plano inválido e forma de pagamento desligada', async () => {
    const { client } = await readyProvider()
    expect((await call('publicar', { plan: 'anual', method: 'pix' }, client)).body.fields.plan).toBeDefined()
    await exec('update public.ajustes_plano set pix_ativo = false')
    expect((await call('publicar', { plan: 'mensal', method: 'pix' }, client)).body.fields.method).toBeDefined()
  })
})

describe('Contatos do prestador', () => {
  it('lista os contatos e grava "respondido"', async () => {
    const client = await signIn('carlos@exemplo.com')
    const list = await call('meus_contatos', undefined, client)
    expect(list.body).toHaveLength(4)
    expect(list.body.filter((c: { answered: boolean }) => !c.answered)).toHaveLength(2)

    await call('marcar_respondido', { id: 'c1' }, client)
    expect((await row(`select respondido from public.contatos where id = 'c1'`))!.respondido).toBe(true)
  })

  it('não marca contato de outro prestador', async () => {
    const { client } = await readyProvider()
    expect((await call('marcar_respondido', { id: 'c1' }, client)).status).toBe(404)
    expect((await row(`select respondido from public.contatos where id = 'c1'`))!.respondido).toBe(false)
  })
})
