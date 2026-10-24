import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { trialEndDate } from '../features/conta/plano'
import type { Account } from '../features/conta/usuario'
import { apiServer, dbRow, loginAs, newAccount, readyProvider } from '../test/api-server'
import { Publicar } from './Publicar'

const renderPublicar = (account?: Account) => render(<Publicar account={account} onLogin={vi.fn()} />)
const setPlan = (sql: string) => apiServer().db.prepare(`UPDATE plan_settings SET ${sql}`).run()
const checkout = () => screen.findByRole('heading', { name: 'Publique seu perfil' })

describe('Publicar', () => {
  it('sem login pede para entrar', () => {
    renderPublicar()
    expect(screen.getByText('Entre para publicar seu perfil.')).toBeInTheDocument()
  })

  it('manda quem não é prestador para Serviços', async () => {
    renderPublicar(await loginAs('beatriz@exemplo.com'))
    expect(screen.getByText('Você ainda não oferece serviços.')).toBeInTheDocument()
  })

  it('avisa quando o perfil já está publicado', async () => {
    renderPublicar(await loginAs('carlos@exemplo.com'))
    expect(await screen.findByText('Seu perfil já está publicado.')).toBeInTheDocument()
  })

  it('troca o resumo da cobrança conforme o plano e a forma de pagamento', async () => {
    renderPublicar(await readyProvider())
    await checkout()
    const summary = screen.getByRole('region', { name: 'Resumo da cobrança' })
    expect(summary).toHaveTextContent(/R\$\s19,90/)
    expect(summary).toHaveTextContent(/todo mês no Pix/)

    await userEvent.click(screen.getByRole('radio', { name: /Semestral/ }))
    await userEvent.click(screen.getByRole('radio', { name: /Cartão de crédito/ }))
    expect(summary).toHaveTextContent(/R\$\s99,90/)
    expect(summary).toHaveTextContent(/a cada 6 meses no cartão/)
    expect(screen.getByText('Economize 16%')).toBeInTheDocument()
  })

  it('administração publica direto, sem plano nem pagamento', async () => {
    const account = await readyProvider()
    apiServer().db.prepare('UPDATE accounts SET is_admin = 1 WHERE id = ?').run(account.id)
    renderPublicar({ ...account, isAdmin: true })

    await screen.findByText(/Como administrador, você publica sem plano e sem pagamento/)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByText(/dias grátis|R$/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Publicar perfil' }))
    await waitFor(() => expect(window.location.hash).toBe('#/servicos'))
    expect(dbRow('SELECT status, plan, payment_method FROM professionals WHERE account_id = ?', account.id)).toEqual({
      status: 'publicado',
      plan: null,
      payment_method: null,
    })
  })

  it('publica e grava plano, forma de pagamento e fim do período grátis', async () => {
    const account = await readyProvider()
    renderPublicar(account)
    await checkout()
    await userEvent.click(screen.getByRole('radio', { name: /Semestral/ }))
    await userEvent.click(screen.getByRole('radio', { name: /Cartão de crédito/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Começar 15 dias grátis e publicar' }))

    await waitFor(() => expect(window.location.hash).toBe('#/servicos'))
    expect(dbRow('SELECT status, plan, payment_method, trial_ends_at FROM professionals WHERE account_id = ?', account.id)).toEqual({
      status: 'publicado',
      plan: 'semestral',
      payment_method: 'cartao',
      trial_ends_at: trialEndDate({ trialDays: 15 } as never),
    })
  })

  it('mostra o que falta quando alguém abre a tela antes da hora', async () => {
    renderPublicar(await newAccount({ asProvider: true }))
    await checkout()
    await userEvent.click(screen.getByRole('button', { name: /grátis e publicar/ }))
    expect(await screen.findByText(/Falta completar o perfil.*foto.*WhatsApp.*serviço/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /grátis e publicar/ })).toBeEnabled()
  })

  it('mostra só as formas de pagamento ligadas na administração', async () => {
    setPlan('pix_enabled = 0')
    renderPublicar(await readyProvider())
    await checkout()
    expect(screen.queryByRole('radio', { name: /Pix/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Cartão de crédito/ })).toBeChecked()
  })

  it('não deixa publicar sem forma de pagamento', async () => {
    setPlan('pix_enabled = 0, card_enabled = 0')
    renderPublicar(await readyProvider())
    await checkout()
    expect(screen.getByText(/Nenhuma forma de pagamento está disponível/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /grátis e publicar/ })).toBeDisabled()
  })
})
