// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, newClient, readyProvider, resetDb, signUp, VALID_CPFS } from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

describe('Meus dados', () => {
  it('traz a conta, os aceites e o CPF mascarado de quem pede', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const { status, body } = await call('meus_dados', undefined, client)
    expect(status).toBe(200)
    expect(body.conta).toMatchObject({
      nome: 'Ana Lima',
      email: account.email,
      cpf: '***.982.247-**',
      dataNascimento: '1990-03-25',
    })
    expect(body.conta.aceites.termosVersao).toBeDefined()
    expect(JSON.stringify(body)).not.toContain(VALID_CPFS[0])
    expect(body.prestador).toMatchObject({ situacao: 'rascunho', servicos: [] })
  })

  it('quem só contrata não tem CPF nem perfil de prestador', async () => {
    const { client } = await signUp()
    const { body } = await call('meus_dados', undefined, client)
    expect(body.conta.cpf).toBeNull()
    expect(body.prestador).toBeNull()
    expect(body).toMatchObject({ contatosFeitos: [], avaliacoesFeitas: [], pedidosSobreDados: [] })
  })

  it('traz serviços, contatos e avaliações dos dois lados, e os pedidos', async () => {
    const pro = await readyProvider()
    await call('publicar', { plan: 'mensal', method: 'pix' }, pro.client)
    const cliente = await signUp({ name: 'Bruno Costa' })
    await call('registrar_contato', { id: pro.account.professionalId, task: 'Instalar chuveiro' }, cliente.client)
    await call('avaliar', { id: pro.account.professionalId, rating: 5, comment: 'Ótimo' }, cliente.client)
    await call('enviar_pedido', { subject: 'acesso', message: 'Quero meus dados' }, cliente.client)

    const doCliente = (await call('meus_dados', undefined, cliente.client)).body
    expect(doCliente.contatosFeitos).toHaveLength(1)
    expect(doCliente.avaliacoesFeitas).toEqual([expect.objectContaining({ nota: 5, comentario: 'Ótimo' })])
    expect(doCliente.pedidosSobreDados).toEqual([expect.objectContaining({ assunto: 'acesso' })])

    const doPrestador = (await call('meus_dados', undefined, pro.client)).body
    expect(doPrestador.prestador.servicos).toEqual([expect.objectContaining({ nome: 'Instalar chuveiro', preco: 130 })])
    expect(doPrestador.prestador.contatosRecebidos).toEqual([expect.objectContaining({ cliente: 'Bruno Costa' })])
    expect(doPrestador.prestador.avaliacoesRecebidas).toEqual([expect.objectContaining({ autor: 'Bruno', nota: 5 })])
    // Os dados do cliente não aparecem nos do prestador além do que ele já vê no app
    expect(JSON.stringify(doPrestador)).not.toContain(cliente.account.email)
  })

  it('sem login não funciona', async () => {
    expect((await call('meus_dados', undefined, newClient())).status).toBe(401)
  })
})
