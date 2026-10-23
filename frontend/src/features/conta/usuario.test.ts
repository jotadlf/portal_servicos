import { beforeEach, describe, expect, it, vi } from 'vitest'

// Contas e prestadores ficam em memória; cada teste começa dos dados de exemplo
let usuario: typeof import('./usuario')
let dados: typeof import('../profissionais/dados-exemplo')

beforeEach(async () => {
  vi.resetModules()
  usuario = await import('./usuario')
  dados = await import('../profissionais/dados-exemplo')
})

describe('signIn', () => {
  it('entra ignorando maiúsculas e espaços no e-mail', () => {
    expect(usuario.signIn('  Carlos@Exemplo.com ', 'teste123')?.id).toBe('u1')
  })

  it('recusa senha errada ou e-mail desconhecido', () => {
    expect(usuario.signIn('carlos@exemplo.com', 'errada')).toBeUndefined()
    expect(usuario.signIn('ninguem@exemplo.com', 'teste123')).toBeUndefined()
  })
})

describe('isEmailTaken', () => {
  it('compara sem diferenciar maiúsculas', () => {
    expect(usuario.isEmailTaken('BEATRIZ@exemplo.com')).toBe(true)
    expect(usuario.isEmailTaken('nova@exemplo.com')).toBe(false)
  })
})

describe('createAccount', () => {
  it('cria conta só de consumidor com dados limpos', () => {
    const account = usuario.createAccount({
      name: '  Ana Lima ',
      email: ' Ana@Exemplo.com ',
      password: 'segredo',
      asProvider: false,
    })
    expect(account).toMatchObject({ name: 'Ana Lima', email: 'ana@exemplo.com' })
    expect(account.professionalId).toBeUndefined()
    expect(usuario.signIn('ana@exemplo.com', 'segredo')).toBe(account)
  })

  it('cria o perfil de prestador em rascunho quando pedido', () => {
    const account = usuario.createAccount({
      name: 'Ana Lima',
      email: 'ana@exemplo.com',
      password: 'segredo',
      asProvider: true,
    })
    const professional = usuario.getAccountProfessional(account)
    expect(professional).toMatchObject({ name: 'Ana Lima', status: 'rascunho', services: [] })
  })
})

describe('becomeProvider', () => {
  it('cria um único perfil de prestador por conta', () => {
    const before = dados.professionals.length
    usuario.becomeProvider('u2')
    const id = usuario.getAccount('u2')?.professionalId
    expect(id).toBeDefined()
    expect(dados.getProfessional(id!)?.neighborhood).toBe('Setor Marista')

    usuario.becomeProvider('u2')
    expect(usuario.getAccount('u2')?.professionalId).toBe(id)
    expect(dados.professionals.length).toBe(before + 1)
  })

  it('não mexe em quem já é prestador', () => {
    usuario.becomeProvider('u1')
    expect(usuario.getAccount('u1')?.professionalId).toBe('p1')
  })
})

describe('updateAccount', () => {
  it('leva nome, telefone e bairro para o perfil público', () => {
    usuario.updateAccount('u1', {
      name: 'Carlos H.',
      phone: '62999998888',
      address: { ...usuario.getAccount('u1')!.address, neighborhood: 'Setor Oeste', street: 'Rua 1' },
    })
    expect(dados.getProfessional('p1')).toMatchObject({
      name: 'Carlos H.',
      whatsapp: '62999998888',
      neighborhood: 'Setor Oeste',
    })
  })

  it('ignora conta inexistente', () => {
    expect(() => usuario.updateAccount('u999', { name: 'X' })).not.toThrow()
  })
})
