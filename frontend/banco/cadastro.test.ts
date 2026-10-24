// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cadastro,
  call,
  closeDb,
  entrar,
  newClient,
  resetDb,
  row,
  SAMPLE_IDS,
  signIn,
  signUp,
  uniqueEmail,
  VALID_CPFS,
} from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

describe('Cadastro real: dados gravados no banco', () => {
  it('grava a conta de quem só contrata, campo a campo', async () => {
    const { account } = await signUp({ name: '  Ana   Lima ', email: '  Ana.Lima@Exemplo.COM ', password: 'segredo1' })

    const saved = await row('select * from public.contas where id = $1', account.id)
    expect(saved).toMatchObject({
      email: 'ana.lima@exemplo.com',
      nome: 'Ana Lima',
      telefone: '',
      cpf: null,
      foto: null,
      admin: false,
      cep: '',
      cidade: '',
      uf: '',
    })
    expect(saved!.criado_em).toBeInstanceOf(Date)
    expect((await row('select count(*) as n from public.prestadores where conta_id = $1', account.id))!.n).toBe(0)
  })

  it('a senha fica só no Supabase Auth, como hash bcrypt com sal diferente em cada conta', async () => {
    const a = await signUp({ password: 'mesmaSenha' })
    const b = await signUp({ password: 'mesmaSenha' })
    const hash = async (id: string) =>
      (await row('select encrypted_password from auth.users where id = $1', id))!.encrypted_password as string
    const hashA = await hash(a.account.id)

    expect(hashA).toMatch(/^\$2[aby]\$/)
    expect(hashA).not.toContain('mesmaSenha')
    expect(hashA).not.toBe(await hash(b.account.id))
    expect(JSON.stringify(await row('select * from public.contas where id = $1', a.account.id))).not.toContain(
      'mesmaSenha',
    )
  })

  it('grava o prestador com CPF só em dígitos e cria o perfil em rascunho', async () => {
    const { account } = await signUp({ asProvider: true, cpf: '529.982.247-25' })
    expect((await row('select cpf from public.contas where id = $1', account.id))!.cpf).toBe('52998224725')
    expect(await row('select * from public.prestadores where conta_id = $1', account.id)).toMatchObject({
      nome: 'Ana Lima',
      status: 'rascunho',
      plano: null,
      fim_teste: null,
      whatsapp: '',
    })
    expect(account.professionalId).toBeDefined()
  })

  it('não devolve senha nem CPF na resposta', async () => {
    const response = await cadastro({
      name: 'Ana Lima',
      email: uniqueEmail(),
      password: 'segredo1',
      asProvider: true,
      cpf: VALID_CPFS[1],
    })
    const text = JSON.stringify(response.body)
    expect(text).not.toContain('segredo1')
    expect(text).not.toContain(VALID_CPFS[1])
  })

  it('recusa e-mail já usado, mesmo com maiúsculas e espaços', async () => {
    const email = uniqueEmail()
    await signUp({ email })
    const response = await cadastro({ name: 'Outra Pessoa', email: `  ${email.toUpperCase()} `, password: 'segredo1' })
    expect(response.status).toBe(409)
    expect(response.body.fields.email).toMatch(/Já existe uma conta com esse e-mail/)
  })

  it('recusa CPF já usado por outro prestador', async () => {
    await signUp({ asProvider: true, cpf: VALID_CPFS[2] })
    const response = await cadastro({
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
    // Limite do bcrypt, que o Supabase Auth usa (era 128 na API antiga)
    ['senha longa demais', { password: 'a'.repeat(73) }, 'password', /até 72/],
    ['prestador sem CPF', { asProvider: true }, 'cpf', 'Informe seu CPF.'],
    ['prestador com CPF inválido', { asProvider: true, cpf: '52998224700' }, 'cpf', 'Informe um CPF válido.'],
    ['prestador com CPF de dígitos iguais', { asProvider: true, cpf: '11111111111' }, 'cpf', 'Informe um CPF válido.'],
  ])('recusa %s', async (_, data, field, message) => {
    const response = await cadastro({ name: 'Ana Lima', email: uniqueEmail(), password: 'segredo1', ...data })
    expect(response.status).toBe(400)
    expect(response.body.fields[field]).toEqual(typeof message === 'string' ? message : expect.stringMatching(message))
    expect((await row('select count(*) as n from public.contas'))!.n).toBe(3)
  })

  it('aceita nomes com acento, apóstrofo e hífen', async () => {
    const { account } = await signUp({ name: "Joana D'Ávila-Conceição" })
    expect((await row('select nome from public.contas where id = $1', account.id))!.nome).toBe(
      "Joana D'Ávila-Conceição",
    )
  })

  it('ignora CPF enviado por quem não vai oferecer serviços', async () => {
    const { account } = await signUp({ asProvider: false, cpf: VALID_CPFS[3] })
    expect((await row('select cpf from public.contas where id = $1', account.id))!.cpf).toBeNull()
  })

  it('recusa corpo que não é objeto', async () => {
    expect((await call('validar_cadastro', 'isto não é objeto')).status).toBe(400)
    expect((await call('validar_cadastro', [1, 2])).status).toBe(400)
  })

  it('quem chama o signUp direto, pulando a conferência, também é barrado', async () => {
    const email = uniqueEmail()
    const { error } = await newClient().auth.signUp({
      email,
      password: 'segredo1',
      options: { data: { name: 'Ana 2', asProvider: true, cpf: '11111111111' } },
    })
    expect(error).not.toBeNull()
    expect(await row('select 1 from auth.users where email = $1', email)).toBeUndefined()
  })

  it('não dá para virar admin pelos dados do signUp', async () => {
    const client = newClient()
    await client.auth.signUp({
      email: uniqueEmail(),
      password: 'segredo1',
      options: { data: { name: 'Ana Lima', isAdmin: true, admin: true } },
    })
    const me = await call('minha_conta', undefined, client)
    expect(me.body.isAdmin).toBeUndefined()
    expect((await row('select admin from public.contas where id = $1', me.body.id))!.admin).toBe(false)
  })
})

describe('Login real', () => {
  it('entra com a conta de teste, ignorando maiúsculas e espaços no e-mail', async () => {
    const { status, client } = await entrar('  CARLOS@exemplo.com ', 'teste123')
    expect(status).toBe(200)
    expect((await call('minha_conta', undefined, client)).body).toMatchObject({
      id: SAMPLE_IDS.carlos,
      name: 'Carlos Henrique',
      professionalId: 'p1',
    })
  })

  it('entra com a conta recém-criada', async () => {
    const email = uniqueEmail()
    await signUp({ email, password: 'minhaSenha' })
    expect((await entrar(email, 'minhaSenha')).status).toBe(200)
  })

  it('dá a mesma resposta para senha errada e e-mail que não existe', async () => {
    const wrong = await newClient().auth.signInWithPassword({ email: 'carlos@exemplo.com', password: 'errada' })
    const unknown = await newClient().auth.signInWithPassword({ email: 'ninguem@exemplo.com', password: 'errada' })
    expect(wrong.error?.status).toBe(400)
    expect(unknown.error?.status).toBe(400)
    expect(wrong.error?.message).toBe(unknown.error?.message)
  })

  it('diferencia maiúsculas na senha', async () => {
    expect((await entrar('carlos@exemplo.com', 'TESTE123')).status).not.toBe(200)
  })

  it('recusa login sem dados', async () => {
    expect((await entrar('', '')).status).not.toBe(200)
  })

  it('identifica a conta pela sessão e sai de verdade', async () => {
    const client = await signIn('beatriz@exemplo.com')
    expect((await call('minha_conta', undefined, client)).body).toMatchObject({
      id: SAMPLE_IDS.beatriz,
      email: 'beatriz@exemplo.com',
    })
    expect((await row('select count(*) as n from auth.sessions where user_id = $1', SAMPLE_IDS.beatriz))!.n).toBe(1)

    await client.auth.signOut({ scope: 'local' })
    expect((await call('minha_conta', undefined, client)).status).toBe(401)
    expect((await row('select count(*) as n from auth.sessions where user_id = $1', SAMPLE_IDS.beatriz))!.n).toBe(0)
  })

  it('cada login abre uma sessão; sair de uma não derruba a outra', async () => {
    const a = await signIn('beatriz@exemplo.com')
    const b = await signIn('beatriz@exemplo.com')
    await a.auth.signOut({ scope: 'local' })
    expect((await call('minha_conta', undefined, b)).status).toBe(200)
  })

  it('token inventado não entra', async () => {
    const response = await fetch(`${process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'}/rest/v1/rpc/minha_conta`, {
      method: 'POST',
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
        Authorization: 'Bearer token-inventado',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(response.status).toBe(401)
  })
})
