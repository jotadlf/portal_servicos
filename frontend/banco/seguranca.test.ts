// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, entrar, exec, newClient, readyProvider, resetDb, row, signIn, signUp, VALID_CPFS } from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

describe('Textos maliciosos ou incomuns', () => {
  it("SQL injection no login não entra (' OR '1'='1)", async () => {
    const { status } = await entrar("carlos@exemplo.com' OR '1'='1", "' OR '1'='1")
    expect(status).not.toBe(200)
  })

  it('SQL injection em texto livre é gravado como texto, sem efeito no banco', async () => {
    const { client, account } = await readyProvider()
    const attack = "'); DROP TABLE public.contas; --"
    await call('salvar_sobre', { about: attack }, client)
    expect((await row('select sobre from public.prestadores where id = $1', account.professionalId))!.sobre).toBe(attack)
    expect((await row('select count(*) as n from public.contas'))!.n).toBe(4)
  })

  it('HTML/script é gravado literalmente (a tela mostra como texto)', async () => {
    const { client, account } = await readyProvider()
    const xss = '<img src=x onerror=alert(1)><script>alert(1)</script>'
    await call('salvar_sobre', { about: xss }, client)
    expect((await row('select sobre from public.prestadores where id = $1', account.professionalId))!.sobre).toBe(xss)
  })

  it('emoji e acentos chegam inteiros ao banco e de volta', async () => {
    const { client, account } = await readyProvider()
    const text = 'Atendo com carinho 😊 — ação, pão, çedilha, “aspas”'
    await call('salvar_sobre', { about: text }, client)
    expect((await row('select sobre from public.prestadores where id = $1', account.professionalId))!.sobre).toBe(text)
    expect((await call('meu_prestador', undefined, client)).body.about).toBe(text)
  })

  it('nome com emoji é recusado', async () => {
    const response = await call('validar_cadastro', {
      name: 'Ana 😊',
      email: 'emoji@exemplo.com',
      passwordLength: 8,
    })
    expect(response.status).toBe(400)
  })
})

describe('Dados sensíveis nunca saem do banco', () => {
  it('CPF e senha não aparecem em nenhuma resposta', async () => {
    const cpf = VALID_CPFS[4]
    const { client, account } = await readyProvider(cpf)
    await call('publicar', { plan: 'mensal', method: 'pix' }, client)
    const viewer = await signIn('beatriz@exemplo.com')
    const admin = await signIn('admin@exemplo.com')

    const responses = await Promise.all([
      call('minha_conta', undefined, client),
      call('meu_prestador', undefined, client),
      call('prestador', { id: account.professionalId }, viewer),
      call('prestadores', { profissao: 'eletricista', servico: 'Instalar chuveiro' }, viewer),
      call('estatisticas', undefined, admin),
    ])
    for (const response of responses) {
      const text = JSON.stringify(response.body)
      expect(text).not.toContain(cpf)
      expect(text).not.toMatch(/segredo1|password|encrypted/)
    }
  })

  it('as funções internas e a de recriar os dados não abrem pela API', async () => {
    const admin = await signIn('admin@exemplo.com')
    expect((await call('recriar_dados_exemplo', undefined, admin)).status).not.toBe(200)
    const internal = await admin.schema('interno').rpc('conta_json', { conta_id: crypto.randomUUID() })
    expect(internal.error).not.toBeNull()
  })
})

describe('Endereços e erros', () => {
  it('função que não existe não responde', async () => {
    expect((await call('nao_existe')).status).not.toBe(200)
  })

  it('erros vêm com mensagem em português e campo', async () => {
    const response = await call('validar_cadastro', { name: '', email: '' })
    expect(response.body).toEqual({ error: 'Informe seu nome.', fields: { name: 'Informe seu nome.' } })
  })

  // Documenta o comportamento atual para o relatório
  it('PONTO DE ATENÇÃO: cadastro só devolve o primeiro problema de cada vez', async () => {
    const response = await call('validar_cadastro', { name: '', email: 'x', passwordLength: 1 })
    expect(Object.keys(response.body.fields)).toEqual(['name'])
  })

  it('conta apagada não usa mais a sessão', async () => {
    const { client, account } = await signUp()
    await exec('delete from auth.users where id = $1', account.id)
    expect((await call('minha_conta', undefined, client)).status).toBe(401)
    expect((await row('select count(*) as n from auth.sessions where user_id = $1', account.id))!.n).toBe(0)
  })

  it('anônimo não chama nada que exige login', async () => {
    const client = newClient()
    for (const fn of ['meu_prestador', 'salvar_servicos', 'publicar', 'meus_contatos', 'marcar_respondido']) {
      expect((await call(fn, {}, client)).status).toBe(401)
    }
  })
})
