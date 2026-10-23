import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

// Navegação de ponta a ponta pelas rotas do "#"
async function login(email: string) {
  await userEvent.type(await screen.findByLabelText('E-mail'), email)
  await userEvent.type(screen.getByLabelText('Senha'), 'teste123')
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('App', () => {
  it('abre na página inicial', () => {
    render(<App />)
    expect(screen.getByRole('searchbox', { name: 'Buscar serviço' })).toBeInTheDocument()
  })

  it('abre a página pelo endereço', () => {
    window.location.hash = '#/prestador/p1'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Carlos' })).toBeInTheDocument()
  })

  it('entra e volta para a página de onde saiu', async () => {
    window.location.hash = '#/prestador/p1'
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await login('beatriz@exemplo.com')

    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos Henrique' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/prestador/p1')
  })

  it('leva quem administra direto para o painel', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await login('admin@exemplo.com')

    expect(await screen.findByRole('region', { name: 'Números de agora' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/admin')
  })

  it('sai da conta pela página inicial', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await login('beatriz@exemplo.com')

    expect(await screen.findByText(/, Beatriz$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})
