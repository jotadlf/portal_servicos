// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  call,
  closeDb,
  exec,
  newClient,
  PNG_1PX,
  resetDb,
  row,
  SAMPLE_IDS,
  sendPhoto,
  signIn,
  signUp,
  VALID_CPFS,
} from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

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

const profile = (id: string) => row('select * from public.contas where id = $1', id)
const uploadedPhotos = async () =>
  (await row(`select count(*) as n from storage.objects where bucket_id = 'fotos'`))!.n as number

describe('Perfil: cada campo gravado no banco', () => {
  it('normaliza e grava todos os campos', async () => {
    const { client, account } = await signUp()
    const response = await call('salvar_conta', fullProfile, client)
    expect(response.status).toBe(200)

    expect(await profile(account.id)).toMatchObject({
      nome: 'Ana Souza',
      telefone: '62999998888',
      cep: '74215010',
      rua: 'Rua T-30',
      numero: 'Qd 5 Lt 10',
      complemento: 'Apto 302',
      bairro: 'Setor Bueno',
      cidade: 'Pau-d’Arco',
      uf: 'GO',
    })
    expect(response.body.address).toMatchObject({ cep: '74215010', state: 'GO' })
  })

  it('aceita endereço em branco (é opcional)', async () => {
    const { client } = await signUp()
    expect((await call('salvar_conta', { name: 'Ana Lima', phone: '', address: {} }, client)).status).toBe(200)
  })

  it('copia nome, WhatsApp e bairro para o perfil público do prestador (e nada mais)', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    await sendPhoto(client, account.id)
    await call('salvar_conta', fullProfile, client)

    const pro = await row('select * from public.prestadores where conta_id = $1', account.id)
    expect(pro).toMatchObject({ nome: 'Ana Souza', whatsapp: '62999998888', bairro: 'Setor Bueno' })
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
    const { client, account } = await signUp()
    const before = await profile(account.id)
    const response = await call('salvar_conta', { name: 'Ana Lima', ...change }, client)

    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toEqual(typeof message === 'string' ? message : expect.stringMatching(message))
    expect(await profile(account.id)).toEqual(before)
  })

  it('exige foto de quem oferece serviços, não de quem só contrata', async () => {
    const consumer = await signUp()
    expect((await call('salvar_conta', { name: 'Ana Lima' }, consumer.client)).status).toBe(200)

    const provider = await signUp({ asProvider: true, cpf: VALID_CPFS[1] })
    const response = await call('salvar_conta', { name: 'Ana Lima' }, provider.client)
    expect(response.status).toBe(400)
    expect(response.body.fields.photo).toMatch(/Adicione uma foto/)
  })

  it('não deixa mudar e-mail, senha, CPF nem virar admin pelo perfil', async () => {
    const { client, account } = await signUp()
    await call(
      'salvar_conta',
      { name: 'Ana Lima', email: 'outro@exemplo.com', password: 'x', cpf: VALID_CPFS[2], isAdmin: true, admin: true },
      client,
    )
    const saved = await row('select email, cpf, admin from public.contas where id = $1', account.id)
    expect(saved).toMatchObject({ cpf: null, admin: false })
    expect(saved!.email).not.toBe('outro@exemplo.com')
  })

  it('cada um só altera a própria conta', async () => {
    const client = await signIn('beatriz@exemplo.com')
    await call('salvar_conta', { name: 'Beatriz Nova', id: SAMPLE_IDS.carlos }, client)
    expect((await profile(SAMPLE_IDS.carlos))!.nome).toBe('Carlos Henrique')
    expect((await profile(SAMPLE_IDS.beatriz))!.nome).toBe('Beatriz Nova')
  })

  it('as tabelas não abrem direto pela API, nem para quem entrou', async () => {
    const client = await signIn('beatriz@exemplo.com')
    for (const table of ['contas', 'prestadores', 'servicos', 'contatos', 'ajustes_plano']) {
      const read = await client.from(table).select('*')
      expect(read.data ?? []).toEqual([])
    }
    const update = await client.from('contas').update({ admin: true }).eq('id', SAMPLE_IDS.beatriz)
    expect(update.error).not.toBeNull()
    expect((await profile(SAMPLE_IDS.beatriz))!.admin).toBe(false)
  })
})

describe('Perfil: foto', () => {
  it('grava a imagem no Storage, na pasta da conta, e o caminho na conta e no perfil público', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const { status, body, path } = await sendPhoto(client, account.id)
    expect(status).toBe(200)
    expect(body.photo).toBe(path)
    expect(path.startsWith(`${account.id}/`)).toBe(true)
    expect((await profile(account.id))!.foto).toBe(path)
    expect((await row('select foto from public.prestadores where conta_id = $1', account.id))!.foto).toBe(path)

    const { data } = client.storage.from('fotos').getPublicUrl(path)
    const image = await fetch(data.publicUrl)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await image.arrayBuffer()).equals(PNG_1PX)).toBe(true)
  })

  it('não grava na pasta de outra conta nem usa a foto de outra pessoa', async () => {
    const ana = await signUp()
    const bia = await signUp()
    const intruder = await ana.client.storage
      .from('fotos')
      .upload(`${bia.account.id}/x.png`, PNG_1PX, { contentType: 'image/png' })
    expect(intruder.error).not.toBeNull()

    const { path } = await sendPhoto(bia.client, bia.account.id)
    const response = await call('definir_foto', { path }, ana.client)
    expect(response.status).toBe(400)
    expect(response.body.fields.photo).toBe('Escolha um arquivo de imagem, como JPG ou PNG.')
    expect((await profile(ana.account.id))!.foto).toBeNull()
  })

  it('recusa caminho que não existe no Storage', async () => {
    const { client, account } = await signUp()
    const response = await call('definir_foto', { path: `${account.id}/nao-existe.png` }, client)
    expect(response.status).toBe(400)
  })

  it.each([
    ['SVG (pode conter script)', Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml'],
    ['PDF', Buffer.from('%PDF-1.4 conteudo'), 'application/pdf'],
    ['texto', Buffer.from('oi'), 'text/plain'],
  ])('o Storage recusa %s', async (_, data, type) => {
    const { client, account } = await signUp()
    const before = await uploadedPhotos()
    const upload = await client.storage.from('fotos').upload(`${account.id}/arquivo`, data, { contentType: type })
    expect(upload.error).not.toBeNull()
    expect(await uploadedPhotos()).toBe(before)
  })

  it('o Storage recusa foto acima de 5 MB', async () => {
    const { client, account } = await signUp()
    const big = Buffer.alloc(5 * 1024 * 1024 + 10)
    PNG_1PX.copy(big)
    const upload = await client.storage.from('fotos').upload(`${account.id}/grande.png`, big, { contentType: 'image/png' })
    expect(upload.error).not.toBeNull()
  })

  it('sem login não envia foto', async () => {
    const upload = await newClient()
      .storage.from('fotos')
      .upload(`${SAMPLE_IDS.carlos}/x.png`, PNG_1PX, { contentType: 'image/png' })
    expect(upload.error).not.toBeNull()
  })
})

describe('Perfil: virar prestador', () => {
  const prestadores = async (id: string) =>
    (await row('select count(*) as n from public.prestadores where conta_id = $1', id))!.n

  it('cria um único perfil de prestador, mesmo chamando duas vezes', async () => {
    const { client, account } = await signUp()
    await call('virar_prestador', { cpf: VALID_CPFS[0] }, client)
    const second = await call('virar_prestador', { cpf: VALID_CPFS[1] }, client)
    expect(second.body.professionalId).toBeDefined()
    expect(await prestadores(account.id)).toBe(1)
    // A segunda chamada não troca o CPF gravado na primeira
    expect((await profile(account.id))!.cpf).toBe(VALID_CPFS[0])
  })

  it('grava o CPF só com dígitos', async () => {
    const { client, account } = await signUp()
    expect((await call('virar_prestador', { cpf: '529.982.247-25' }, client)).status).toBe(200)
    expect((await profile(account.id))!.cpf).toBe('52998224725')
  })

  it.each([
    [undefined, 'Informe seu CPF.'],
    ['', 'Informe seu CPF.'],
    ['111.111.111-11', 'Informe um CPF válido.'],
    ['529.982.247-26', 'Informe um CPF válido.'],
  ])('recusa CPF %j sem criar o perfil', async (cpf, message) => {
    const { client, account } = await signUp()
    const response = await call('virar_prestador', { cpf }, client)
    expect(response.status).toBe(400)
    expect(response.body.fields).toEqual({ cpf: message })
    expect(await prestadores(account.id)).toBe(0)
    expect((await profile(account.id))!.cpf).toBeNull()
  })

  it('recusa CPF que já é de outra conta', async () => {
    await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const { client, account } = await signUp()
    const response = await call('virar_prestador', { cpf: VALID_CPFS[0] }, client)
    expect(response.status).toBe(409)
    expect(response.body.fields).toEqual({ cpf: 'Já existe uma conta de prestador com esse CPF.' })
    expect(await prestadores(account.id)).toBe(0)
  })

  it('a administração vira prestador sem CPF', async () => {
    const { client, account } = await signUp()
    await exec('update public.contas set admin = true where id = $1', account.id)
    expect((await call('virar_prestador', undefined, client)).status).toBe(200)
    expect(await prestadores(account.id)).toBe(1)
    expect((await profile(account.id))!.cpf).toBeNull()
  })
})

describe('Perfil: CPF fixo', () => {
  it('depois de gravado, o CPF não muda nem direto no banco', async () => {
    const { account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    await expect(exec('update public.contas set cpf = $1 where id = $2', VALID_CPFS[1], account.id)).rejects.toThrow(
      'O CPF não pode ser alterado.',
    )
    await expect(exec('update public.contas set cpf = null where id = $1', account.id)).rejects.toThrow(
      'O CPF não pode ser alterado.',
    )
    expect((await profile(account.id))!.cpf).toBe(VALID_CPFS[0])
  })

  it('salvar o perfil não mexe no CPF', async () => {
    const { client, account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    // Prestador só salva o perfil com foto
    await sendPhoto(client, account.id)
    expect((await call('salvar_conta', { ...fullProfile, cpf: VALID_CPFS[1] }, client)).status).toBe(200)
    expect((await profile(account.id))!.cpf).toBe(VALID_CPFS[0])
  })
})

describe('Perfil: sem login', () => {
  it.each(['minha_conta', 'salvar_conta', 'definir_foto', 'virar_prestador'])('%s responde 401', async (fn) => {
    expect((await call(fn, {})).status).toBe(401)
  })
})
