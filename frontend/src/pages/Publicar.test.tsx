import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPlanSettings, trialEndDate, updatePlanSettings } from '../features/conta/plano'
import {
  createAccount,
  getAccount,
  getAccountProfessional,
  type Account,
} from '../features/conta/usuario'
import { Publicar } from './Publicar'

const originalSettings = { ...getPlanSettings() }
afterEach(() => updatePlanSettings(originalSettings))

let counter = 0
function newProvider(): Account {
  counter += 1
  return createAccount({
    name: 'Ana Lima',
    email: `publicar${counter}@exemplo.com`,
    password: 'segredo',
    asProvider: true,
  })
}

const renderPublicar = (account?: Account) => render(<Publicar account={account} onLogin={vi.fn()} />)

describe('Publicar', () => {
  it('sem login pede para entrar', () => {
    renderPublicar()
    expect(screen.getByText('Entre para publicar seu perfil.')).toBeInTheDocument()
  })

  it('manda quem não é prestador para Serviços', () => {
    renderPublicar(getAccount('u2'))
    expect(screen.getByText('Você ainda não oferece serviços.')).toBeInTheDocument()
  })

  it('avisa quando o perfil já está publicado', () => {
    renderPublicar(getAccount('u1'))
    expect(screen.getByText('Seu perfil já está publicado.')).toBeInTheDocument()
  })

  it('troca o resumo da cobrança conforme o plano e a forma de pagamento', async () => {
    renderPublicar(newProvider())
    const summary = screen.getByRole('region', { name: 'Resumo da cobrança' })
    expect(summary).toHaveTextContent(/R\$\s19,90/)
    expect(summary).toHaveTextContent(/todo mês no Pix/)

    await userEvent.click(screen.getByRole('radio', { name: /Semestral/ }))
    await userEvent.click(screen.getByRole('radio', { name: /Cartão de crédito/ }))
    expect(summary).toHaveTextContent(/R\$\s99,90/)
    expect(summary).toHaveTextContent(/a cada 6 meses no cartão/)
    expect(screen.getByText('Economize 16%')).toBeInTheDocument()
  })

  it('publica com o período grátis e volta para Serviços', async () => {
    const account = newProvider()
    renderPublicar(account)
    await userEvent.click(screen.getByRole('radio', { name: /Semestral/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Começar 15 dias grátis e publicar' }))

    expect(getAccountProfessional(account)).toMatchObject({
      status: 'publicado',
      plan: 'semestral',
      trialEndsAt: trialEndDate(),
    })
    expect(window.location.hash).toBe('#/servicos')
  })

  it('mostra só as formas de pagamento ligadas na administração', () => {
    updatePlanSettings({ pixEnabled: false })
    renderPublicar(newProvider())
    expect(screen.queryByRole('radio', { name: /Pix/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Cartão de crédito/ })).toBeChecked()
  })

  it('não deixa publicar sem forma de pagamento', () => {
    updatePlanSettings({ pixEnabled: false, cardEnabled: false })
    renderPublicar(newProvider())
    expect(screen.getByText(/Nenhuma forma de pagamento está disponível/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /grátis e publicar/ })).toBeDisabled()
  })
})
