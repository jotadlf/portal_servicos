import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getToken } from '../lib/api'
import { apiServer, dbRow, newAccount } from '../test/api-server'
import { Entrar } from './Entrar'

const setPlan = (sql: string) => apiServer().db.prepare(`UPDATE plan_settings SET ${sql}`).run()

describe('Entrar: login real', () => {
  async function fillLogin(password: string, email = 'carlos@exemplo.com') {
    await userEvent.type(screen.getByLabelText(/^E-mail/), email)
    await userEvent.type(screen.getByLabelText(/^Senha/), password)
  }

  it('entra com e-mail e senha corretos e guarda a sessão', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="login" onSignedIn={onSignedIn} />)
    await fillLogin('teste123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' })))
    expect(getToken()).toBeDefined()
    expect(dbRow('SELECT count(*) AS n FROM sessions WHERE account_id = ?', 'u1')?.n).toBe(1)
  })

  it('oferece entrar como visitante, voltando para a página de antes', () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} guestHref="#/servicos" />)
    expect(screen.getByRole('link', { name: 'Entrar como visitante' })).toHaveAttribute('href', '#/servicos')
  })

  it('avisa quando a senha está errada e limpa o aviso ao digitar', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="login" onSignedIn={onSignedIn} />)
    await fillLogin('errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/E-mail ou senha incorretos/)).toBeInTheDocument()
    expect(onSignedIn).not.toHaveBeenCalled()
    expect(getToken()).toBeUndefined()

    await userEvent.type(screen.getByLabelText(/^Senha/), 'x')
    expect(screen.queryByText(/E-mail ou senha incorretos/)).not.toBeInTheDocument()
  })

  it('bloqueia o botão enquanto confere a senha (sem envio duplo)', async () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    await fillLogin('teste123')
    const button = screen.getByRole('button', { name: 'Entrar' })
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    await waitFor(() => expect(dbRow('SELECT count(*) AS n FROM sessions')?.n).toBe(1))
  })

  it('avisa quando o servidor não responde', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    await fillLogin('teste123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/Não foi possível falar com o servidor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('avisa que o login social ainda não funciona', async () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }))
    expect(screen.getByText(/Entrar com Google ainda não está disponível/)).toBeInTheDocument()
  })

  it('não oferece entrar com Apple', () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument()
  })

  it('oferece o link para criar conta', () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '#/cadastro')
  })
})

describe('Entrar: validação dos campos', () => {
  it('marca os campos vazios ao tentar entrar e leva o foco ao primeiro', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="login" onSignedIn={onSignedIn} />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^E-mail/)).toHaveAccessibleDescription('Informe seu e-mail.')
    expect(screen.getByLabelText(/^Senha/)).toHaveAccessibleDescription('Informe sua senha.')
    expect(screen.getByLabelText(/^E-mail/)).toHaveFocus()
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('só acusa o campo depois que a pessoa sai dele', async () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    const email = screen.getByLabelText(/^E-mail/)

    await userEvent.type(email, 'ana@')
    expect(email).not.toHaveAttribute('aria-invalid')

    await userEvent.tab()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Informe um e-mail válido, como nome@exemplo.com.')

    await userEvent.type(email, 'exemplo.com')
    expect(email).not.toHaveAttribute('aria-invalid')
  })

  it('confere todos os campos do cadastro', async () => {
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /Também quero oferecer serviços/ }))
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'ana@exemplo')
    await userEvent.type(screen.getByLabelText(/^Senha/), '123')
    await userEvent.type(screen.getByLabelText(/^CPF/), '11111111111')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta de prestador' }))

    expect(screen.getByLabelText(/^Nome/)).toHaveAccessibleDescription('Informe seu nome.')
    expect(screen.getByLabelText(/^E-mail/)).toHaveAccessibleDescription(/Informe um e-mail válido/)
    expect(screen.getByLabelText(/^Senha/)).toHaveAccessibleDescription('A senha precisa ter pelo menos 6 caracteres.')
    expect(screen.getByLabelText(/^CPF/)).toHaveAccessibleDescription('Informe um CPF válido.')
    expect(screen.getByLabelText(/^Nome/)).toHaveFocus()
    expect(dbRow('SELECT count(*) AS n FROM accounts')?.n).toBe(3)
  })

  it('recusa nome com números', async () => {
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    const name = screen.getByLabelText(/^Nome/)
    await userEvent.type(name, 'Ana 123')
    await userEvent.tab()

    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Use só letras no nome, sem números ou símbolos.')

    await userEvent.clear(name)
    await userEvent.type(name, "Joana D'Ávila")
    expect(name).not.toHaveAttribute('aria-invalid')
  })
})

describe('Entrar: mostrar senha', () => {
  it('mostra e esconde a senha digitada', async () => {
    render(<Entrar mode="login" onSignedIn={vi.fn()} />)
    const password = screen.getByLabelText(/^Senha/)
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    await userEvent.type(password, 'teste123')
    expect(password).toHaveAttribute('type', 'password')

    await userEvent.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('teste123')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(toggle)
    expect(password).toHaveAttribute('type', 'password')
  })

  it('tocar no olho não acusa o campo antes da hora', async () => {
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    const password = screen.getByLabelText(/^Senha/)
    await userEvent.type(password, '123')
    await userEvent.click(screen.getAllByRole('button', { name: 'Mostrar senha' })[0])
    expect(password).not.toHaveAttribute('aria-invalid')
  })
})

describe('Entrar: oferta para prestador (valores do banco)', () => {
  const toggle = () => userEvent.click(screen.getByRole('checkbox', { name: /Também quero oferecer serviços/ }))

  it('só mostra o preço depois de ligar a opção', async () => {
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    expect(screen.queryByText(/Gratuito/)).not.toBeInTheDocument()
    await toggle()
    expect(await screen.findByText('Gratuito por 15 dias')).toBeInTheDocument()
    expect(screen.getByText(/Depois de 15 dias, será cobrado/)).toHaveTextContent(/R\$\s19,90 por mês/)
    await toggle()
    expect(screen.queryByText(/Gratuito/)).not.toBeInTheDocument()
  })

  it('acompanha os valores gravados pela administração', async () => {
    setPlan('trial_days = 30, monthly_price = 25')
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    await toggle()
    expect(await screen.findByText('Gratuito por 30 dias')).toBeInTheDocument()
    expect(screen.getByText(/Depois de 30 dias/)).toHaveTextContent(/R\$\s25,00 por mês/)
  })

  it('sem período grátis mostra só o valor', async () => {
    setPlan('trial_days = 0')
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    await toggle()
    expect(await screen.findByText(/Oferecer serviços custa/)).toHaveTextContent(/R\$\s19,90 por mês/)
    expect(screen.queryByText(/Gratuito/)).not.toBeInTheDocument()
  })
})

describe('Entrar: cadastro real', () => {
  async function fill(email: string, password: string, name = 'Ana Lima') {
    await userEvent.type(screen.getByLabelText(/^Nome/), name)
    await userEvent.type(screen.getByLabelText(/^E-mail/), email)
    await userEvent.type(screen.getByLabelText(/^Senha/), password)
    await userEvent.type(screen.getByLabelText(/^Confirmar senha/), password)
  }
  const provider = () => screen.getByRole('checkbox', { name: /Também quero oferecer serviços/ })
  const cpfField = () => screen.getByLabelText(/^CPF/)

  it('grava a conta de consumidor no banco e abre a sessão', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="cadastro" onSignedIn={onSignedIn} />)
    expect(screen.queryByLabelText(/^CPF/)).not.toBeInTheDocument()
    await fill('  Ana.Lima@Exemplo.com ', 'segredo1', '  Ana   Lima ')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    const [account, next] = onSignedIn.mock.calls[0]
    expect(next).toBeUndefined()
    expect(dbRow('SELECT email, name, cpf, phone FROM accounts WHERE id = ?', account.id)).toEqual({
      email: 'ana.lima@exemplo.com',
      name: 'Ana Lima',
      cpf: null,
      phone: '',
    })
    expect(dbRow('SELECT password_hash FROM accounts WHERE id = ?', account.id)?.password_hash).not.toContain('segredo1')
    expect(getToken()).toBeDefined()
  })

  it('grava o prestador com CPF e o perfil em rascunho, e leva para Serviços', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="cadastro" onSignedIn={onSignedIn} />)
    await fill('ana.prestadora@exemplo.com', 'segredo1')
    await userEvent.click(provider())
    await userEvent.type(cpfField(), '52998224725')
    expect(cpfField()).toHaveValue('529.982.247-25')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta de prestador' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    const [account, next] = onSignedIn.mock.calls[0]
    expect(next).toBe('#/servicos')
    expect(dbRow('SELECT cpf FROM accounts WHERE id = ?', account.id)?.cpf).toBe('52998224725')
    expect(dbRow('SELECT status FROM professionals WHERE account_id = ?', account.id)?.status).toBe('rascunho')
  })

  it('exige repetir a mesma senha', async () => {
    const onSignedIn = vi.fn()
    render(<Entrar mode="cadastro" onSignedIn={onSignedIn} />)
    await userEvent.type(screen.getByLabelText(/^Nome/), 'Ana Lima')
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'repete@exemplo.com')
    await userEvent.type(screen.getByLabelText(/^Senha/), 'segredo')
    const confirm = screen.getByLabelText(/^Confirmar senha/)
    await userEvent.type(confirm, 'segredx')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(confirm).toHaveAccessibleDescription('As senhas não são iguais.')
    expect(confirm).toHaveFocus()
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('mostra no campo o e-mail já cadastrado (resposta do servidor)', async () => {
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    await fill('BEATRIZ@exemplo.com', 'segredo1')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    const email = screen.getByLabelText(/^E-mail/)
    await waitFor(() => expect(email).toHaveAccessibleDescription(/Já existe uma conta com esse e-mail/))
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveFocus()

    await userEvent.type(email, 'x')
    expect(email).not.toHaveAttribute('aria-invalid')
  })

  it('mostra no campo o CPF já usado por outro prestador', async () => {
    await newAccount({ asProvider: true, cpfIndex: 0 })
    sessionStorage.clear()
    render(<Entrar mode="cadastro" onSignedIn={vi.fn()} />)
    await fill('outra.prestadora@exemplo.com', 'segredo1')
    await userEvent.click(provider())
    await userEvent.type(cpfField(), '52998224725')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta de prestador' }))

    await waitFor(() => expect(cpfField()).toHaveAccessibleDescription('Já existe uma conta de prestador com esse CPF.'))
  })
})
