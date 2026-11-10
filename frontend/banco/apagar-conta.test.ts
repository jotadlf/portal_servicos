// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ADULT_BIRTH_DATE,
  call,
  closeDb,
  exec,
  newClient,
  readyProvider,
  resetDb,
  row,
  SAMPLE_IDS,
  signUp,
  VALID_CPFS,
} from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

const count = async (sql: string, ...args: unknown[]) => Number((await row(sql, ...args))!.n)

describe('Apagar conta', () => {
  it('apaga o login, a conta e o prestador com tudo dele', async () => {
    const { client, account } = await readyProvider()
    const pro = (await row('select id from public.prestadores where conta_id = $1', account.id))!.id
    await exec(
      `insert into public.contatos (prestador_id, cliente, servico, mensagem, bairro, data)
       values ($1, 'Bia', 'Instalar chuveiro', 'Oi', 'Centro', current_date)`,
      pro,
    )

    expect((await call('apagar_conta', undefined, client)).status).toBe(200)

    expect(await count('select count(*) as n from auth.users where id = $1', account.id)).toBe(0)
    expect(await count('select count(*) as n from public.contas where id = $1', account.id)).toBe(0)
    expect(await count('select count(*) as n from public.prestadores where id = $1', pro)).toBe(0)
    expect(await count('select count(*) as n from public.servicos where prestador_id = $1', pro)).toBe(0)
    expect(await count('select count(*) as n from public.contatos where prestador_id = $1', pro)).toBe(0)
  })

  it('a sessão deixa de valer', async () => {
    const { client, account } = await signUp()
    await call('apagar_conta', undefined, client)
    expect((await call('minha_conta', undefined, client)).status).toBe(401)
    expect(await count('select count(*) as n from auth.sessions where user_id = $1', account.id)).toBe(0)
  })

  it('o CPF fica livre para uma conta nova', async () => {
    const { client } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    await call('apagar_conta', undefined, client)
    const response = await call('validar_cadastro', {
      name: 'Ana Lima',
      email: 'nova@exemplo.com',
      passwordLength: 8,
      asProvider: true,
      cpf: VALID_CPFS[0],
      birthDate: ADULT_BIRTH_DATE,
    })
    expect(response.status).toBe(200)
  })

  it('não mexe nas outras contas', async () => {
    const before = await count('select count(*) as n from public.contas')
    const { client } = await signUp()
    await call('apagar_conta', undefined, client)
    expect(await count('select count(*) as n from public.contas')).toBe(before)
  })

  it('a administração não apaga a própria conta', async () => {
    const { client, account } = await signUp()
    await exec('update public.contas set admin = true where id = $1', account.id)
    const response = await call('apagar_conta', undefined, client)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('A conta da administração não pode ser apagada pelo app.')
    expect(await count('select count(*) as n from public.contas where id = $1', account.id)).toBe(1)
  })

  it('sem login responde 401 e não apaga nada', async () => {
    expect((await call('apagar_conta', {}, newClient())).status).toBe(401)
    expect(await count('select count(*) as n from public.contas where id = $1', SAMPLE_IDS.carlos)).toBe(1)
  })
})
