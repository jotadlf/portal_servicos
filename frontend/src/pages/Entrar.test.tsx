import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Entrar } from './Entrar'

describe('Entrar: login', () => {
  it('entra com e-mail e senha corretos', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="login" onSignedIn={onSignedIn} />)

    await userEvent.type(screen.getByLabelText('E-mail'), 'carlos@exemplo.com')
    await userEvent.type(screen.getByLabelText(/^Senha/), 'teste123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })

  it('avisa quando a senha está errada e limpa o aviso ao digitar', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="login" onSignedIn={onSignedIn} />)

    await userEvent.type(screen.getByLabelText('E-mail'), 'carlos@exemplo.com')
    await userEvent.type(screen.getByLabelText(/^Senha/), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByText(/E-mail ou senha incorretos/)).toBeInTheDocument()
    expect(onSignedIn).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/^Senha/), 'x')
    expect(screen.queryByText(/E-mail ou senha incorretos/)).not.toBeInTheDocument()
  })

  it('avisa que o login social ainda não funciona', async () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }))
    expect(screen.getByText(/Entrar com Google ainda não está disponível/)).toBeInTheDocument()
  })

  it('oferece o link para criar conta', () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '#/cadastro')
  })
})

describe('Entrar: cadastro', () => {
  async function fill(email: string, password: string) {
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana Lima')
    await userEvent.type(screen.getByLabelText('E-mail'), email)
    await userEvent.type(screen.getByLabelText(/^Senha/), password)
  }

  it('recusa senha curta', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="cadastro" onSignedIn={onSignedIn} />)
    await fill('curta@exemplo.com', '123')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByText('A senha precisa ter pelo menos 6 caracteres.')).toBeInTheDocument()
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('recusa e-mail já cadastrado', async () => {
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    await fill('beatriz@exemplo.com', 'segredo')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText(/Já existe uma conta com esse e-mail/)).toBeInTheDocument()
  })

  it('cria conta de consumidor e volta para a página anterior', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="cadastro" onSignedIn={onSignedIn} />)
    await fill('ana@exemplo.com', 'segredo')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(onSignedIn).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@exemplo.com', name: 'Ana Lima' }),
      undefined,
    )
  })

  it('cria conta de prestador e leva para Serviços', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="cadastro" onSignedIn={onSignedIn} />)
    await fill('ana.prestadora@exemplo.com', 'segredo')
    await userEvent.click(screen.getByRole('checkbox', { name: /Também quero oferecer serviços/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta de prestador' }))

    const [account, next] = onSignedIn.mock.calls[0]
    expect(account.professionalId).toBeDefined()
    expect(next).toBe('#/servicos')
  })
})
