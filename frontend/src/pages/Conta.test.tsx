import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createAccount, getAccount, type Account } from '../features/conta/usuario'
import { Conta } from './Conta'

let counter = 0
function newAccount(): Account {
  counter += 1
  return createAccount({
    name: 'Ana Lima',
    email: `conta${counter}@exemplo.com`,
    password: 'segredo',
    asProvider: false,
  })
}

function renderConta(account?: Account) {
  const handlers = { onLogin: vi.fn(), onLogout: vi.fn() }
  render(<Conta account={account} {...handlers} />)
  return handlers
}

function mockViaCep(data: object) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })))
}

describe('Conta', () => {
  it('sem login pede para entrar', async () => {
    const { onLogin } = renderConta()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('formata o WhatsApp e recusa número incompleto', async () => {
    const account = newAccount()
    renderConta(account)
    const phone = screen.getByLabelText(/^WhatsApp/)

    await userEvent.type(phone, '6299999')
    expect(phone).toHaveValue('(62) 9999-9')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    expect(screen.getByText(/Informe o WhatsApp com DDD/)).toBeInTheDocument()
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(getAccount(account.id)?.phone).toBe('')
  })

  it('salva nome, telefone e endereço', async () => {
    const account = newAccount()
    renderConta(account)

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), '  Ana Souza ')
    await userEvent.type(screen.getByLabelText(/^WhatsApp/), '62999998888')
    await userEvent.type(screen.getByLabelText('Bairro'), 'Setor Oeste')
    await userEvent.type(screen.getByLabelText('UF'), 'go')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))

    expect(screen.getByText(/Alterações salvas nesta sessão/)).toBeInTheDocument()
    expect(getAccount(account.id)).toMatchObject({
      name: 'Ana Souza',
      phone: '62999998888',
      address: expect.objectContaining({ neighborhood: 'Setor Oeste', state: 'GO' }),
    })

    // Mexer no formulário de novo apaga o aviso de salvo
    await userEvent.type(screen.getByLabelText('Número'), '1')
    expect(screen.queryByText(/Alterações salvas nesta sessão/)).not.toBeInTheDocument()
  })

  it('preenche o endereço pelo CEP e põe o foco no número', async () => {
    mockViaCep({ logradouro: 'Rua T-30', bairro: 'Setor Bueno', localidade: 'Goiânia', uf: 'GO' })
    renderConta(newAccount())

    await userEvent.type(screen.getByLabelText('CEP'), '74215010')
    expect(screen.getByLabelText('CEP')).toHaveValue('74215-010')

    expect(await screen.findByDisplayValue('Rua T-30')).toBeInTheDocument()
    expect(screen.getByLabelText('Bairro')).toHaveValue('Setor Bueno')
    expect(screen.getByLabelText('Cidade')).toHaveValue('Goiânia')
    expect(screen.getByLabelText('Número')).toHaveFocus()
  })

  it('avisa quando o CEP não existe', async () => {
    mockViaCep({ erro: true })
    renderConta(newAccount())
    await userEvent.type(screen.getByLabelText('CEP'), '00000000')
    expect(await screen.findByText(/Não encontramos esse CEP/)).toBeInTheDocument()
  })

  it('mostra o link da administração só para admin', () => {
    renderConta(getAccount('u3'))
    expect(screen.getByRole('link', { name: 'Abrir administração do portal' })).toHaveAttribute('href', '#/admin')
  })

  it('sai da conta', async () => {
    const { onLogout } = renderConta(newAccount())
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalled()
  })
})
