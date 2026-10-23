// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from './test-server.ts'
import { readyProvider, signIn, signUp, VALID_CPFS } from './helpers.test-utils.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
beforeEach(() => server.reset())
afterAll(() => server.close())

const row = (sql: string, ...args: string[]) => server.db.prepare(sql).get(...args) as Record<string, unknown>

describe('Textos maliciosos ou incomuns', () => {
  it("SQL injection no login não entra (' OR '1'='1)", async () => {
    const response = await server.request('POST', '/api/auth/entrar', {
      email: "carlos@exemplo.com' OR '1'='1",
      password: "' OR '1'='1",
    })
    expect(response.status).toBe(401)
  })

  it('SQL injection em texto livre é gravado como texto, sem efeito no banco', async () => {
    const { token, account } = await readyProvider(server)
    const attack = "'); DROP TABLE accounts; --"
    await server.request('PATCH', '/api/prestador/sobre', { about: attack }, token)
    expect(row('SELECT about FROM professionals WHERE id = ?', account.professionalId!).about).toBe(attack)
    expect(row('SELECT count(*) AS n FROM accounts').n).toBe(4)
  })

  it('HTML/script é gravado literalmente (a tela mostra como texto)', async () => {
    const { token, account } = await readyProvider(server)
    const xss = '<img src=x onerror=alert(1)><script>alert(1)</script>'
    await server.request('PATCH', '/api/prestador/sobre', { about: xss }, token)
    expect(row('SELECT about FROM professionals WHERE id = ?', account.professionalId!).about).toBe(xss)
  })

  it('emoji e acentos chegam inteiros ao banco e de volta', async () => {
    const { token, account } = await readyProvider(server)
    const text = 'Atendo com carinho 😊 — ação, pão, çedilha, “aspas”'
    await server.request('PATCH', '/api/prestador/sobre', { about: text }, token)
    expect(row('SELECT about FROM professionals WHERE id = ?', account.professionalId!).about).toBe(text)
    const me = await server.request('GET', '/api/prestador', undefined, token)
    expect(me.body.about).toBe(text)
  })

  it('nome com emoji é recusado', async () => {
    const response = await server.request('POST', '/api/auth/cadastro', {
      name: 'Ana 😊',
      email: 'emoji@exemplo.com',
      password: 'segredo1',
    })
    expect(response.status).toBe(400)
  })
})

describe('Dados sensíveis nunca saem do servidor', () => {
  it('CPF e hash da senha não aparecem em nenhuma resposta', async () => {
    const cpf = VALID_CPFS[4]
    const { token, account } = await readyProvider(server, cpf)
    await server.request('POST', '/api/prestador/publicar', { plan: 'mensal', method: 'pix' }, token)
    const viewer = await signIn(server, 'beatriz@exemplo.com')
    const admin = await signIn(server, 'admin@exemplo.com')

    const responses = await Promise.all([
      server.request('GET', '/api/auth/eu', undefined, token),
      server.request('GET', '/api/prestador', undefined, token),
      server.request('GET', `/api/prestadores/${account.professionalId}`, undefined, viewer),
      server.request('GET', '/api/prestadores?profissao=eletricista&servico=Instalar%20chuveiro', undefined, viewer),
      server.request('GET', '/api/admin/estatisticas', undefined, admin),
    ])
    for (const response of responses) {
      const text = JSON.stringify(response.body)
      expect(text).not.toContain(cpf)
      expect(text).not.toMatch(/scrypt|password/)
    }
  })

  it('respostas da API não ficam em cache', async () => {
    const response = await server.request('GET', '/api/catalogo')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('Endereços e métodos', () => {
  it('rota que não existe: 404; método errado: 405', async () => {
    expect((await server.request('GET', '/api/nao-existe')).status).toBe(404)
    expect((await server.request('DELETE', '/api/auth/entrar')).status).toBe(405)
  })

  it('erros vêm com mensagem em português e campo', async () => {
    const response = await server.request('POST', '/api/auth/cadastro', { name: '', email: '', password: '' })
    expect(response.body).toEqual({ error: 'Informe seu nome.', fields: { name: 'Informe seu nome.' } })
  })

  // Documenta o comportamento atual para o relatório
  it('PONTO DE ATENÇÃO: cadastro só devolve o primeiro problema de cada vez', async () => {
    const response = await server.request('POST', '/api/auth/cadastro', { name: '', email: 'x', password: '1' })
    expect(Object.keys(response.body.fields)).toEqual(['name'])
  })

  it('conta apagada derruba as sessões dela', async () => {
    const { token, account } = await signUp(server)
    server.db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id)
    expect((await server.request('GET', '/api/auth/eu', undefined, token)).status).toBe(401)
    expect(row('SELECT count(*) AS n FROM sessions WHERE account_id = ?', account.id).n).toBe(0)
  })
})
