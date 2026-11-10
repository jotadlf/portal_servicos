// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { call, closeDb, exec, newClient, resetDb, row, signUp, VALID_CPFS } from './ajuda.ts'

beforeEach(resetDb)
afterAll(closeDb)

describe('CPF cifrado', () => {
  it('não fica em texto em nenhuma coluna da conta', async () => {
    const { account } = await signUp({ asProvider: true, cpf: '529.982.247-25' })
    const saved = await row('select * from public.contas where id = $1', account.id)
    expect(saved).not.toHaveProperty('cpf')
    const text = JSON.stringify(saved, (_, value) => (value?.type === 'Buffer' ? Buffer.from(value.data).toString('latin1') : value))
    expect(text).not.toContain('52998224725')
    expect(text).not.toContain('529.982.247-25')
  })

  it('o hash é o HMAC do CPF, e a cifra volta ao CPF só com a chave', async () => {
    const { account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const saved = await row(
      `select cpf_hash = interno.cpf_hash($2) as hash_confere,
              interno.decifrar_cpf(cpf_cifrado) as cpf,
              cpf_hash = encode(extensions.digest($2, 'sha256'), 'hex') as hash_sem_chave
       from public.contas where id = $1`,
      account.id,
      VALID_CPFS[0],
    )
    expect(saved).toEqual({ hash_confere: true, cpf: VALID_CPFS[0], hash_sem_chave: false })
  })

  it('cifrar o mesmo CPF duas vezes dá resultados diferentes', async () => {
    const both = await row(`select interno.cifrar_cpf('52998224725') = interno.cifrar_cpf('52998224725') as iguais`)
    expect(both!.iguais).toBe(false)
  })

  it('o banco não deixa duas contas com o mesmo CPF, mesmo por fora das funções', async () => {
    const { account } = await signUp({ asProvider: true, cpf: VALID_CPFS[0] })
    const other = await signUp()
    await expect(
      exec(
        'update public.contas set cpf_hash = (select cpf_hash from public.contas where id = $1) where id = $2',
        account.id,
        other.account.id,
      ),
    ).rejects.toThrow(/duplicate key|unique/)
  })

  it('quem usa o app não chama as funções da cifra nem lê as chaves', async () => {
    const { client } = await signUp()
    for (const fn of ['chave', 'cpf_hash', 'cifrar_cpf', 'decifrar_cpf']) {
      const { error } = await client.schema('interno' as 'public').rpc(fn, {})
      expect(error).not.toBeNull()
    }
    expect((await newClient().schema('vault' as 'public').from('decrypted_secrets').select('*')).error).not.toBeNull()
    expect((await call('minha_conta', undefined, client)).body).not.toHaveProperty('cpf')
  })
})
