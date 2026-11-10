// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, exec, newClient, resetDb, row, signIn, signUp } from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

const pedido = { subject: 'correcao', message: 'Meu CPF está com um dígito trocado.' }

describe('Pedidos sobre dados: quem tem conta', () => {
  it('envia o pedido e vê só os próprios, do mais novo ao mais antigo', async () => {
    const { client, account } = await signUp()
    const first = await call('enviar_pedido', pedido, client)
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ subject: 'correcao', message: pedido.message })
    expect(first.body.answeredAt).toBeUndefined()
    await call('enviar_pedido', { subject: 'acesso', message: 'Quero ver meus dados.' }, client)

    // Outra pessoa não vê os pedidos dela
    const other = await signUp()
    await call('enviar_pedido', { subject: 'duvida', message: 'Outro pedido' }, other.client)

    const mine = await call('meus_pedidos', undefined, client)
    expect(mine.body.map((r: { subject: string }) => r.subject)).toEqual(['acesso', 'correcao'])
    expect(await row('select conta_id from public.pedidos where id = $1', first.body.id)).toEqual({
      conta_id: account.id,
    })
  })

  it('apara a mensagem e grava o texto literalmente', async () => {
    const { client } = await signUp()
    const text = "  <script>alert(1)</script> '); drop table public.pedidos; --  "
    const response = await call('enviar_pedido', { subject: 'outro', message: text }, client)
    expect(response.body.message).toBe(text.trim())
    expect((await row('select count(*) as n from public.pedidos'))!.n).toBe(1)
  })

  it.each([
    ['sem assunto', { message: 'oi' }, 'subject', 'Escolha o assunto.'],
    ['assunto desconhecido', { subject: 'apagar_tudo', message: 'oi' }, 'subject', 'Escolha o assunto.'],
    ['sem mensagem', { subject: 'acesso' }, 'message', 'Escreva o seu pedido.'],
    ['mensagem só com espaços', { subject: 'acesso', message: '   ' }, 'message', 'Escreva o seu pedido.'],
    ['mensagem longa demais', { subject: 'acesso', message: 'a'.repeat(1001) }, 'message', /até 1000/],
    ['mensagem que não é texto', { subject: 'acesso', message: 123 }, 'message', /formato inválido/],
  ])('recusa %s', async (_, data, field, message) => {
    const { client } = await signUp()
    const response = await call('enviar_pedido', data, client)
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toEqual(typeof message === 'string' ? message : expect.stringMatching(message))
    expect((await row('select count(*) as n from public.pedidos'))!.n).toBe(0)
  })

  it('aceita até 5 pedidos sem resposta ao mesmo tempo', async () => {
    const { client } = await signUp()
    for (let i = 0; i < 5; i++) {
      expect((await call('enviar_pedido', { subject: 'duvida', message: `Pedido ${i}` }, client)).status).toBe(200)
    }
    const sixth = await call('enviar_pedido', { subject: 'duvida', message: 'Mais um' }, client)
    expect(sixth.status).toBe(429)
    expect(sixth.body.error).toMatch(/5 pedidos esperando resposta/)

    // Respondido um, abre vaga
    await exec('update public.pedidos set respondido_em = now() where ctid = (select min(ctid) from public.pedidos)')
    expect((await call('enviar_pedido', { subject: 'duvida', message: 'Agora vai' }, client)).status).toBe(200)
  })

  it('apagar a conta apaga os pedidos dela', async () => {
    const { client, account } = await signUp()
    await call('enviar_pedido', pedido, client)
    expect((await call('apagar_conta', undefined, client)).status).toBe(200)
    expect((await row('select count(*) as n from public.pedidos where conta_id = $1', account.id))!.n).toBe(0)
  })
})

describe('Pedidos sobre dados: administração', () => {
  it('vê todos, os sem resposta primeiro, com nome e e-mail, e marca como respondido', async () => {
    const ana = await signUp()
    const first = await call('enviar_pedido', pedido, ana.client)
    const second = await call('enviar_pedido', { subject: 'exclusao', message: 'Apaguem tudo.' }, ana.client)
    const admin = await signIn('admin@exemplo.com')

    const marked = await call('marcar_pedido_respondido', { id: first.body.id }, admin)
    expect(marked.status).toBe(200)
    expect(marked.body.answeredAt).toBeDefined()

    const list = await call('pedidos_admin', undefined, admin)
    expect(list.body.map((r: { id: string }) => r.id)).toEqual([second.body.id, first.body.id])
    expect(list.body[0]).toMatchObject({ name: 'Ana Lima', email: ana.account.email, subject: 'exclusao' })

    // Marcar de novo não muda a data da resposta
    const again = await call('marcar_pedido_respondido', { id: first.body.id }, admin)
    expect(again.body.answeredAt).toBe(marked.body.answeredAt)
  })

  it('pedido que não existe responde 404', async () => {
    const admin = await signIn('admin@exemplo.com')
    for (const id of ['00000000-0000-4000-8000-000000000099', 'nao-e-uuid', undefined]) {
      expect((await call('marcar_pedido_respondido', { id }, admin)).status).toBe(404)
    }
  })

  it('quem não administra não vê nem marca pedidos de ninguém', async () => {
    const ana = await signUp()
    const sent = await call('enviar_pedido', pedido, ana.client)
    const beatriz = await signIn('beatriz@exemplo.com')
    expect((await call('pedidos_admin', undefined, beatriz)).status).toBe(403)
    expect((await call('marcar_pedido_respondido', { id: sent.body.id }, ana.client)).status).toBe(403)
    expect((await row('select respondido_em from public.pedidos where id = $1', sent.body.id))!.respondido_em).toBeNull()
  })
})

describe('Pedidos sobre dados: acesso', () => {
  it('sem login nada funciona', async () => {
    const client = newClient()
    for (const fn of ['enviar_pedido', 'meus_pedidos', 'pedidos_admin', 'marcar_pedido_respondido']) {
      expect((await call(fn, pedido, client)).status).toBe(401)
    }
  })

  it('a tabela não é acessível direto pela API, nem para ler nem para gravar', async () => {
    const { client, account } = await signUp()
    await call('enviar_pedido', pedido, client)
    const read = await client.from('pedidos').select('*')
    expect(read.error).not.toBeNull()
    const write = await client.from('pedidos').insert({ conta_id: account.id, assunto: 'outro', mensagem: 'x' })
    expect(write.error).not.toBeNull()
    const update = await client.from('pedidos').update({ respondido_em: new Date().toISOString() }).neq('assunto', '')
    expect(update.error).not.toBeNull()
  })
})
