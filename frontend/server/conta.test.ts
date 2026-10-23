// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from './test-server.ts'
import { PNG_1PX, signIn, signUp, VALID_CPFS } from './helpers.test-utils.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
beforeEach(() => server.reset())
afterAll(() => server.close())

const row = (sql: string, ...args: string[]) => server.db.prepare(sql).get(...args) as Record<string, unknown>

const fullProfile = {
  name: '  Ana   Souza ',
  phone: '(62) 99999-8888',
  address: {
    cep: '74215-010',
    street: ' Rua T-30 ',
    number: 'Qd 5 Lt 10',
    complement: 'Apto 302',
    neighborhood: 'Setor Bueno',
    city: 'Pau-d’Arco',
    state: 'go',
  },
}

describe('Perfil: cada campo gravado no banco', () => {
  it('normaliza e grava todos os campos', async () => {
    const { token, account } = await signUp(server)
    const response = await server.request('PATCH', '/api/conta', fullProfile, token)
    expect(response.status).toBe(200)

    expect(row('SELECT * FROM accounts WHERE id = ?', account.id)).toMatchObject({
      name: 'Ana Souza',
      phone: '62999998888',
      cep: '74215010',
      street: 'Rua T-30',
      number: 'Qd 5 Lt 10',
      complement: 'Apto 302',
      neighborhood: 'Setor Bueno',
      city: 'Pau-d’Arco',
      state: 'GO',
    })
    expect(response.body.address).toMatchObject({ cep: '74215010', state: 'GO' })
  })

  it('aceita endereço em branco (é opcional)', async () => {
    const { token } = await signUp(server)
    const response = await server.request('PATCH', '/api/conta', { name: 'Ana Lima', phone: '', address: {} }, token)
    expect(response.status).toBe(200)
  })

  it('copia nome, WhatsApp e bairro para o perfil público do prestador (e nada mais)', async () => {
    const { token, account } = await signUp(server, { asProvider: true, cpf: VALID_CPFS[0] })
    await server.request('POST', '/api/conta/foto', { photo: PNG_1PX }, token)
    await server.request('PATCH', '/api/conta', fullProfile, token)

    const pro = row('SELECT * FROM professionals WHERE account_id = ?', account.id)
    expect(pro).toMatchObject({ name: 'Ana Souza', whatsapp: '62999998888', neighborhood: 'Setor Bueno' })
    expect(JSON.stringify(pro)).not.toContain('Rua T-30')
  })

  it.each([
    ['nome com número', { name: 'Ana 2' }, 'name', /só letras/],
    ['nome vazio', { name: '  ' }, 'name', 'Informe seu nome.'],
    ['WhatsApp sem DDD', { phone: '99999888' }, 'phone', /com DDD/],
    ['WhatsApp com DDD começando em 0', { phone: '0299998888' }, 'phone', /com DDD/],
    ['CEP incompleto', { address: { cep: '74215' } }, 'cep', 'Complete os 8 números do CEP.'],
    ['cidade com número', { address: { city: 'Goiânia 2' } }, 'city', 'Use só letras no nome da cidade.'],
    ['UF que não existe', { address: { state: 'XY' } }, 'state', 'UF inválida.'],
    ['rua com mais de 80 letras', { address: { street: 'R'.repeat(81) } }, 'street', /até 80/],
    ['complemento que não é texto', { address: { complement: 42 } }, 'complement', /formato inválido/],
  ])('recusa %s e não altera o banco', async (_, change, field, message) => {
    const { token, account } = await signUp(server)
    const before = row('SELECT * FROM accounts WHERE id = ?', account.id)
    const response = await server.request('PATCH', '/api/conta', { name: 'Ana Lima', ...change }, token)

    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toEqual(typeof message === 'string' ? message : expect.stringMatching(message))
    expect(row('SELECT * FROM accounts WHERE id = ?', account.id)).toEqual(before)
  })

  it('exige foto de quem oferece serviços, não de quem só contrata', async () => {
    const consumer = await signUp(server)
    expect((await server.request('PATCH', '/api/conta', { name: 'Ana Lima' }, consumer.token)).status).toBe(200)

    const provider = await signUp(server, { asProvider: true, cpf: VALID_CPFS[1] })
    const response = await server.request('PATCH', '/api/conta', { name: 'Ana Lima' }, provider.token)
    expect(response.status).toBe(400)
    expect(response.body.fields.photo).toMatch(/Adicione uma foto/)
  })

  it('não deixa mudar e-mail, senha, CPF nem virar admin pelo perfil', async () => {
    const { token, account } = await signUp(server)
    await server.request(
      'PATCH',
      '/api/conta',
      { name: 'Ana Lima', email: 'outro@exemplo.com', password: 'x', cpf: VALID_CPFS[2], isAdmin: true, is_admin: 1 },
      token,
    )
    const saved = row('SELECT email, cpf, is_admin FROM accounts WHERE id = ?', account.id)
    expect(saved).toMatchObject({ cpf: null, is_admin: 0 })
    expect(saved.email).not.toBe('outro@exemplo.com')
  })

  it('cada um só altera a própria conta', async () => {
    const token = await signIn(server, 'beatriz@exemplo.com')
    await server.request('PATCH', '/api/conta', { name: 'Beatriz Nova', id: 'u1' }, token)
    expect(row(`SELECT name FROM accounts WHERE id = 'u1'`).name).toBe('Carlos Henrique')
    expect(row(`SELECT name FROM accounts WHERE id = 'u2'`).name).toBe('Beatriz Nova')
  })
})

describe('Perfil: foto', () => {
  it('grava a imagem no banco e devolve a mesma imagem', async () => {
    const { token, account } = await signUp(server)
    const response = await server.request('POST', '/api/conta/foto', { photo: PNG_1PX }, token)
    expect(response.body.photo).toMatch(/^\/api\/fotos\/[\w-]+$/)

    const photoId = row('SELECT photo_id FROM accounts WHERE id = ?', account.id).photo_id as string
    const saved = row('SELECT mime, data FROM photos WHERE id = ?', photoId)
    expect(saved.mime).toBe('image/png')
    expect(Buffer.from(saved.data as Uint8Array).equals(Buffer.from(PNG_1PX.split(',')[1], 'base64'))).toBe(true)

    const image = await fetch(server.url + response.body.photo)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(image.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await image.arrayBuffer()).equals(Buffer.from(saved.data as Uint8Array))).toBe(true)
  })

  it('trocar a foto apaga a antiga do banco', async () => {
    const { token } = await signUp(server)
    await server.request('POST', '/api/conta/foto', { photo: PNG_1PX }, token)
    await server.request('POST', '/api/conta/foto', { photo: PNG_1PX }, token)
    expect(row(`SELECT count(*) AS n FROM photos WHERE id NOT LIKE 'exemplo-%'`).n).toBe(1)
  })

  it.each([
    ['SVG (pode conter script)', 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64')],
    ['PDF disfarçado de PNG', 'data:image/png;base64,' + Buffer.from('%PDF-1.4 conteudo').toString('base64')],
    ['texto que não é data URL', 'https://exemplo.com/foto.png'],
    ['campo vazio', ''],
  ])('recusa %s', async (_, photo) => {
    const { token } = await signUp(server)
    const response = await server.request('POST', '/api/conta/foto', { photo }, token)
    expect(response.status).toBe(400)
    expect(response.body.fields.photo).toBe('Escolha um arquivo de imagem, como JPG ou PNG.')
    expect(row(`SELECT count(*) AS n FROM photos WHERE id NOT LIKE 'exemplo-%'`).n).toBe(0)
  })

  it('recusa foto acima de 5 MB', async () => {
    const { token } = await signUp(server)
    const big = Buffer.alloc(5 * 1024 * 1024 + 10)
    Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(big)
    const response = await server.request('POST', '/api/conta/foto', { photo: `data:image/png;base64,${big.toString('base64')}` }, token)
    expect(response.status).toBe(400)
    expect(response.body.fields.photo).toBe('A foto precisa ter até 5 MB.')
  })

  it('recusa envio acima de 8 MB sem ler tudo', async () => {
    const { token } = await signUp(server)
    const response = await server.request('POST', '/api/conta/foto', { photo: 'x'.repeat(9 * 1024 * 1024) }, token)
    expect(response.status).toBe(413)
  })

  it('foto que não existe responde 404', async () => {
    expect((await fetch(`${server.url}/api/fotos/nao-existe`)).status).toBe(404)
  })
})

describe('Perfil: virar prestador', () => {
  it('cria um único perfil de prestador, mesmo chamando duas vezes', async () => {
    const { token, account } = await signUp(server)
    await server.request('POST', '/api/conta/prestador', undefined, token)
    const second = await server.request('POST', '/api/conta/prestador', undefined, token)
    expect(second.body.professionalId).toBeDefined()
    expect(row('SELECT count(*) AS n FROM professionals WHERE account_id = ?', account.id).n).toBe(1)
  })

  it('PONTO DE ATENÇÃO: vira prestador sem informar CPF', async () => {
    const { token, account } = await signUp(server)
    const response = await server.request('POST', '/api/conta/prestador', undefined, token)
    expect(response.status).toBe(200)
    expect(row('SELECT cpf FROM accounts WHERE id = ?', account.id).cpf).toBeNull()
  })
})

describe('Perfil: sem login', () => {
  it.each([
    ['GET', '/api/auth/eu'],
    ['PATCH', '/api/conta'],
    ['POST', '/api/conta/foto'],
    ['POST', '/api/conta/prestador'],
    ['POST', '/api/auth/sair'],
  ])('%s %s responde 401', async (method, path) => {
    expect((await server.request(method, path, method === 'GET' ? undefined : {})).status).toBe(401)
  })
})
