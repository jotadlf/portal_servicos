// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, readyProvider, resetDb, row, rows, SAMPLE_IDS, signIn, signUp, todayInBrazil } from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

const contactsOf = (clientId: string) =>
  rows('select prestador_id, cliente, servico, bairro, data from public.contatos where cliente_id = $1', clientId)

// p3 (exemplo): nota 5 com 3 avaliações, soma 15
const ratingOf = async (id: string) =>
  (await row('select nota, total_avaliacoes from public.prestadores where id = $1', id))!

describe('Registrar contato', () => {
  it('grava o contato com o nome e o bairro de quem chamou', async () => {
    const client = await signIn('beatriz@exemplo.com')
    expect((await call('registrar_contato', { id: 'p1', task: 'Instalar chuveiro' }, client)).status).toBe(200)

    expect(await contactsOf(SAMPLE_IDS.beatriz)).toEqual([
      { prestador_id: 'p1', cliente: 'Beatriz Rocha', servico: 'Instalar chuveiro', bairro: 'Setor Marista', data: todayInBrazil() },
    ])
    const carlos = await signIn('carlos@exemplo.com')
    const list = (await call('meus_contatos', undefined, carlos)).body
    expect(list).toHaveLength(5)
    expect(list[0]).toMatchObject({ client: 'Beatriz Rocha', task: 'Instalar chuveiro', answered: false })
  })

  it('tocar de novo no mesmo dia não repete o contato', async () => {
    const client = await signIn('beatriz@exemplo.com')
    await call('registrar_contato', { id: 'p1' }, client)
    await call('registrar_contato', { id: 'p1', task: 'Instalar chuveiro' }, client)
    await call('registrar_contato', { id: 'p1', task: 'Instalar chuveiro' }, client)
    expect(await contactsOf(SAMPLE_IDS.beatriz)).toMatchObject([{ servico: 'Instalar chuveiro' }])
  })

  it('serviço que o prestador não oferece fica em branco', async () => {
    const client = await signIn('beatriz@exemplo.com')
    await call('registrar_contato', { id: 'p1', task: 'Pintar parede' }, client)
    expect(await contactsOf(SAMPLE_IDS.beatriz)).toMatchObject([{ servico: '' }])
  })

  it('o próprio prestador não gera contato', async () => {
    const client = await signIn('carlos@exemplo.com')
    expect((await call('registrar_contato', { id: 'p1' }, client)).status).toBe(200)
    expect(await contactsOf(SAMPLE_IDS.carlos)).toEqual([])
  })

  it('prestador em rascunho ou que não existe: 404', async () => {
    const { account } = await readyProvider()
    const client = await signIn('beatriz@exemplo.com')
    expect((await call('registrar_contato', { id: account.professionalId }, client)).status).toBe(404)
    expect((await call('registrar_contato', { id: 'p999' }, client)).status).toBe(404)
  })
})

describe('Avaliar prestador', () => {
  it('sem ter falado com o prestador, não avalia', async () => {
    const client = await signIn('beatriz@exemplo.com')
    expect((await call('minha_avaliacao', { id: 'p3' }, client)).body).toEqual({ own: false, canReview: false, review: null })
    const response = await call('avaliar', { id: 'p3', rating: 5 }, client)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('Fale com Rafael pelo WhatsApp antes de avaliar.')
  })

  it('avalia, a nota entra na média e aparece primeiro na lista pública', async () => {
    const client = await signIn('beatriz@exemplo.com')
    await call('registrar_contato', { id: 'p3' }, client)
    expect((await call('minha_avaliacao', { id: 'p3' }, client)).body.canReview).toBe(true)

    const saved = await call('avaliar', { id: 'p3', rating: 1, comment: '  Não apareceu.  ' }, client)
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ rating: 4, reviews: 4, review: { author: 'Beatriz', rating: 1, comment: 'Não apareceu.' } })
    expect(await ratingOf('p3')).toEqual({ nota: 4, total_avaliacoes: 4 })

    const list = (await call('avaliacoes', { id: 'p3' })).body
    expect(list[0]).toMatchObject({ author: 'Beatriz', rating: 1, date: todayInBrazil() })
    expect((await call('minha_avaliacao', { id: 'p3' }, client)).body.review).toMatchObject({ rating: 1 })
  })

  it('refazer troca a nota sem contar duas vezes', async () => {
    const client = await signIn('beatriz@exemplo.com')
    await call('registrar_contato', { id: 'p3' }, client)
    await call('avaliar', { id: 'p3', rating: 1 }, client)
    await call('avaliar', { id: 'p3', rating: 5, comment: 'Voltou e resolveu.' }, client)

    expect(await ratingOf('p3')).toEqual({ nota: 5, total_avaliacoes: 4 })
    expect(await rows('select nota from public.avaliacoes where cliente_id = $1', SAMPLE_IDS.beatriz)).toEqual([{ nota: 5 }])
  })

  it('recusa nota fora de 1 a 5 e comentário longo', async () => {
    const client = await signIn('beatriz@exemplo.com')
    await call('registrar_contato', { id: 'p3' }, client)
    for (const rating of [0, 6, 4.5, '5', null]) {
      const response = await call('avaliar', { id: 'p3', rating }, client)
      expect(response.status, String(rating)).toBe(400)
      expect(response.body.fields.rating).toBe('Escolha de 1 a 5 estrelas.')
    }
    const long = await call('avaliar', { id: 'p3', rating: 5, comment: 'a'.repeat(501) }, client)
    expect(long.body.fields.comment).toBeDefined()
    expect(await ratingOf('p3')).toEqual({ nota: 5, total_avaliacoes: 3 })
  })

  it('o próprio prestador não se avalia', async () => {
    const client = await signIn('carlos@exemplo.com')
    expect((await call('minha_avaliacao', { id: 'p1' }, client)).body).toMatchObject({ own: true, canReview: false })
    expect((await call('avaliar', { id: 'p1', rating: 5 }, client)).status).toBe(403)
  })

  it('apagar a conta do cliente tira os contatos e a avaliação dele da média', async () => {
    const { client, account } = await signUp()
    await call('registrar_contato', { id: 'p3' }, client)
    await call('avaliar', { id: 'p3', rating: 1 }, client)
    expect(await ratingOf('p3')).toEqual({ nota: 4, total_avaliacoes: 4 })

    await call('apagar_conta', undefined, client)
    expect(await ratingOf('p3')).toEqual({ nota: 5, total_avaliacoes: 3 })
    expect(await contactsOf(account.id)).toEqual([])
  })

  it('sem login, nada disso abre', async () => {
    for (const fn of ['registrar_contato', 'minha_avaliacao', 'avaliar']) {
      expect((await call(fn, { id: 'p3', rating: 5 })).status).toBe(401)
    }
  })
})
