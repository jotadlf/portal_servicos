// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from './test-server.ts'
import { signIn, signUp, uniqueEmail, VALID_CPFS } from './helpers.test-utils.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
beforeEach(() => server.reset())
afterAll(() => server.close())

const row = (sql: string, ...args: string[]) => server.db.prepare(sql).get(...args) as Record<string, unknown>

describe('Cadastro real: dados gravados no banco', () => {
  it('grava a conta de quem só contrata, campo a campo', async () => {
    const { account, token } = await signUp(server, {
      name: '  Ana   Lima ',
      email: '  Ana.Lima@Exemplo.COM ',
      password: 'segredo1',
    })
    expect(token).toMatch(/^[\w-]{40,}$/)

    const saved = row('SELECT * FROM accounts WHERE id = ?', account.id)
    expect(saved).toMatchObject({
      email: 'ana.lima@exemplo.com',
      name: 'Ana Lima',
      phone: '',
      cpf: null,
      photo_id: null,
      is_admin: 0,
      cep: '',
      city: '',
      state: '',
    })
    expect(saved.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(row('SELECT count(*) AS n FROM professionals WHERE account_id = ?', account.id).n).toBe(0)
  })

  it('guarda a senha só como hash, com sal diferente em cada conta', async () => {
    const a = await signUp(server, { password: 'mesmaSenha' })
    const b = await signUp(server, { password: 'mesmaSenha' })
    const hashA = row('SELECT password_hash FROM accounts WHERE id = ?', a.account.id).password_hash as string
    const hashB = row('SELECT password_hash FROM accounts WHERE id = ?', b.account.id).password_hash as string

    expect(hashA).toMatch(/^scrypt\$[\w+/=]+\$[\w+/=]+$/)
    expect(hashA).not.toContain('mesmaSenha')
    expect(hashA).not.toBe(hashB)
  })

  it('grava o prestador com CPF só em dígitos e cria o perfil em rascunho', async () => {
    const { account } = await signUp(server, { asProvider: true, cpf: '529.982.247-25' })
    expect(row('SELECT cpf FROM accounts WHERE id = ?', account.id).cpf).toBe('52998224725')
    expect(row('SELECT * FROM professionals WHERE account_id = ?', account.id)).toMatchObject({
      name: 'Ana Lima',
      status: 'rascunho',
      plan: null,
      trial_ends_at: null,
      whatsapp: '',
    })
    expect(account.professionalId).toBeDefined()
  })

  it('não devolve senha, hash nem CPF na resposta', async () => {
    const response = await server.request('POST', '/api/auth/cadastro', {
      name: 'Ana Lima',
      email: uniqueEmail(),
      password: 'segredo1',
      asProvider: true,
      cpf: VALID_CPFS[1],
    })
    const text = JSON.stringify(response.body)
    expect(text).not.toContain('segredo1')
    expect(text).not.toContain('scrypt')
    expect(text).not.toContain(VALID_CPFS[1])
  })

  it('recusa e-mail já usado, mesmo com maiúsculas e espaços', async () => {
    const email = uniqueEmail()
    await signUp(server, { email })
    const response = await server.request('POST', '/api/auth/cadastro', {
      name: 'Outra Pessoa',
      email: `  ${email.toUpperCase()} `,
      password: 'segredo1',
    })
    expect(response.status).toBe(409)
    expect(response.body.fields.email).toMatch(/Já existe uma conta com esse e-mail/)
  })

  it('recusa CPF já usado por outro prestador', async () => {
    await signUp(server, { asProvider: true, cpf: VALID_CPFS[2] })
    const response = await server.request('POST', '/api/auth/cadastro', {
      name: 'Outra Pessoa',
      email: uniqueEmail(),
      password: 'segredo1',
      asProvider: true,
      cpf: VALID_CPFS[2],
    })
    expect(response.status).toBe(409)
    expect(response.body.fields.cpf).toBe('Já existe uma conta de prestador com esse CPF.')
  })

  it.each([
    ['nome vazio', { name: '' }, 'name', 'Informe seu nome.'],
    ['nome com número', { name: 'Ana 2' }, 'name', /só letras/],
    ['nome com símbolo', { name: 'Ana@Lima' }, 'name', /só letras/],
    ['nome com mais de 60 letras', { name: 'A'.repeat(61) }, 'name', /até 60/],
    ['nome que não é texto', { name: 123 }, 'name', /formato inválido/],
    ['e-mail vazio', { email: '' }, 'email', 'Informe seu e-mail.'],
    ['e-mail sem domínio', { email: 'ana@' }, 'email', /e-mail válido/],
    ['e-mail com espaço no meio', { email: 'ana lima@exemplo.com' }, 'email', /e-mail válido/],
    ['e-mail que não é texto', { email: null }, 'email', 'Informe seu e-mail.'],
    ['senha curta', { password: '12345' }, 'password', /pelo menos 6/],
    ['senha que não é texto', { password: 123456 }, 'password', /pelo menos 6/],
    ['senha longa demais', { password: 'a'.repeat(129) }, 'password', /até 128/],
    ['prestador sem CPF', { asProvider: true }, 'cpf', 'Informe seu CPF.'],
    ['prestador com CPF inválido', { asProvider: true, cpf: '52998224700' }, 'cpf', 'Informe um CPF válido.'],
    ['prestador com CPF de dígitos iguais', { asProvider: true, cpf: '11111111111' }, 'cpf', 'Informe um CPF válido.'],
  ])('recusa %s', async (_, data, field, message) => {
    const response = await server.request('POST', '/api/auth/cadastro', {
      name: 'Ana Lima',
      email: uniqueEmail(),
      password: 'segredo1',
      ...data,
    })
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toEqual(typeof message === 'string' ? message : expect.stringMatching(message))
    expect(row('SELECT count(*) AS n FROM accounts').n).toBe(3)
  })

  it('aceita nomes com acento, apóstrofo e hífen', async () => {
    const { account } = await signUp(server, { name: "Joana D'Ávila-Conceição" })
    expect(row('SELECT name FROM accounts WHERE id = ?', account.id).name).toBe("Joana D'Ávila-Conceição")
  })

  it('ignora CPF enviado por quem não vai oferecer serviços', async () => {
    const response = await server.request('POST', '/api/auth/cadastro', {
      name: 'Ana Lima',
      email: uniqueEmail(),
      password: 'segredo1',
      asProvider: false,
      cpf: VALID_CPFS[3],
    })
    expect(row('SELECT cpf FROM accounts WHERE id = ?', response.body.account.id).cpf).toBeNull()
  })

  it('recusa corpo que não é JSON de objeto', async () => {
    expect((await server.request('POST', '/api/auth/cadastro', 'isto não é json')).status).toBe(400)
    expect((await server.request('POST', '/api/auth/cadastro', '[1,2]')).status).toBe(400)
  })
})

describe('Login real', () => {
  it('entra com a conta de teste, ignorando maiúsculas e espaços no e-mail', async () => {
    const response = await server.request('POST', '/api/auth/entrar', {
      email: '  CARLOS@exemplo.com ',
      password: 'teste123',
    })
    expect(response.status).toBe(200)
    expect(response.body.account).toMatchObject({ id: 'u1', name: 'Carlos Henrique', professionalId: 'p1' })
  })

  it('entra com a conta recém-criada', async () => {
    const email = uniqueEmail()
    await signUp(server, { email, password: 'minhaSenha' })
    expect((await server.request('POST', '/api/auth/entrar', { email, password: 'minhaSenha' })).status).toBe(200)
  })

  it('dá a mesma resposta para senha errada e e-mail que não existe', async () => {
    const wrong = await server.request('POST', '/api/auth/entrar', { email: 'carlos@exemplo.com', password: 'errada' })
    const unknown = await server.request('POST', '/api/auth/entrar', { email: 'ninguem@exemplo.com', password: 'errada' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body).toEqual(unknown.body)
  })

  it('diferencia maiúsculas na senha', async () => {
    expect((await server.request('POST', '/api/auth/entrar', { email: 'carlos@exemplo.com', password: 'TESTE123' })).status).toBe(401)
  })

  it('recusa login sem dados', async () => {
    expect((await server.request('POST', '/api/auth/entrar', {})).status).toBe(401)
  })

  it('identifica a conta pelo token e sai de verdade', async () => {
    const token = await signIn(server, 'beatriz@exemplo.com')
    const me = await server.request('GET', '/api/auth/eu', undefined, token)
    expect(me.body).toMatchObject({ id: 'u2', email: 'beatriz@exemplo.com' })

    expect((await server.request('POST', '/api/auth/sair', undefined, token)).status).toBe(204)
    expect((await server.request('GET', '/api/auth/eu', undefined, token)).status).toBe(401)
  })

  it('guarda só o hash do token da sessão', async () => {
    const token = await signIn(server, 'beatriz@exemplo.com')
    const sessions = server.db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[]
    expect(sessions).toHaveLength(1)
    expect(sessions[0].token_hash).not.toBe(token)
  })

  it('sessão vencida não vale mais', async () => {
    const token = await signIn(server, 'beatriz@exemplo.com')
    server.db.prepare(`UPDATE sessions SET expires_at = datetime('now', '-1 minute')`).run()
    expect((await server.request('GET', '/api/auth/eu', undefined, token)).status).toBe(401)
  })

  it('cada login abre uma sessão; sair de uma não derruba a outra', async () => {
    const a = await signIn(server, 'beatriz@exemplo.com')
    const b = await signIn(server, 'beatriz@exemplo.com')
    await server.request('POST', '/api/auth/sair', undefined, a)
    expect((await server.request('GET', '/api/auth/eu', undefined, b)).status).toBe(200)
  })

  it('token inventado ou mal formatado não entra', async () => {
    expect((await server.request('GET', '/api/auth/eu', undefined, 'token-inventado')).status).toBe(401)
    const response = await fetch(`${server.url}/api/auth/eu`, { headers: { Authorization: 'Basic abc' } })
    expect(response.status).toBe(401)
  })

  // Documenta o comportamento atual para o relatório: não há bloqueio após erros seguidos
  it('PONTO CRÍTICO: não limita tentativas seguidas de senha', async () => {
    for (let i = 0; i < 15; i++) {
      await server.request('POST', '/api/auth/entrar', { email: 'carlos@exemplo.com', password: `errada${i}` })
    }
    const response = await server.request('POST', '/api/auth/entrar', { email: 'carlos@exemplo.com', password: 'teste123' })
    expect(response.status).toBe(200)
  })
})
