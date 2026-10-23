import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { getToken } from './lib/api'
import { apiServer, loginAs } from './test/api-server'

// Navegação de ponta a ponta pelas rotas do "#", com o servidor e o banco reais
async function login(email: string) {
  await userEvent.type(await screen.findByLabelText(/^E-mail/), email)
  await userEvent.type(screen.getByLabelText(/^Senha/), 'teste123')
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('App', () => {
  it('abre na página inicial', async () => {
    render(<App />)
    expect(await screen.findByRole('searchbox', { name: 'Buscar serviço' })).toBeInTheDocument()
  })

  it('abre a página pelo endereço', async () => {
    window.location.hash = '#/prestador/p1'
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos' })).toBeInTheDocument()
  })

  it('entra e volta para a página de onde saiu, já com os dados completos', async () => {
    window.location.hash = '#/prestador/p1'
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    await login('beatriz@exemplo.com')

    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos Henrique' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/prestador/p1')
  })

  it('leva quem administra direto para o painel', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    await login('admin@exemplo.com')

    expect(await screen.findByRole('region', { name: 'Números de agora' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/admin')
  })

  it('quem já entrou e volta para #/entrar não vê o formulário de novo', async () => {
    await loginAs('beatriz@exemplo.com')
    window.location.hash = '#/entrar'
    render(<App />)
    expect(await screen.findByText('Você já está na sua conta, Beatriz.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^E-mail/)).not.toBeInTheDocument()
  })

  it('recarregar a página mantém a pessoa na conta', async () => {
    await loginAs('beatriz@exemplo.com')
    render(<App />)
    expect(await screen.findByText(/, Beatriz$/)).toBeInTheDocument()
  })

  it('sair encerra a sessão no servidor', async () => {
    await loginAs('beatriz@exemplo.com')
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    await waitFor(() => expect(apiServer().db.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 }))
    expect(getToken()).toBeUndefined()
  })

  it('sessão vencida no meio do uso volta para visitante', async () => {
    await loginAs('beatriz@exemplo.com')
    window.location.hash = '#/conta'
    render(<App />)
    const saveButton = await screen.findByRole('button', { name: 'Salvar perfil' })

    // A sessão some no servidor; a próxima chamada recebe 401
    apiServer().db.prepare('DELETE FROM sessions').run()
    await userEvent.click(saveButton)
    expect(await screen.findByText('Entre para ver seu perfil.')).toBeInTheDocument()
  })
})
