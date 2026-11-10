import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sendDataRequest } from '../features/conta/pedidos'
import type { Account } from '../features/conta/usuario'
import { CONTROLLER } from '../lib/controlador'
import { dbRow, dbRows, newAccount } from '../test/supabase'
import { Contato } from './Contato'

function renderContato(account?: Account) {
  const onLogin = vi.fn()
  render(<Contato account={account} onLogin={onLogin} />)
  return { onLogin }
}

const send = () => userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))

describe('Contato: pedidos sobre dados', () => {
  it('sem login pede para entrar e mostra o e-mail', async () => {
    const { onLogin } = renderContato()
    expect(screen.getByRole('link', { name: CONTROLLER.email })).toHaveAttribute('href', `mailto:${CONTROLLER.email}`)
    expect(screen.queryByRole('button', { name: 'Enviar pedido' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('grava o pedido no banco e mostra em "Seus pedidos"', async () => {
    const account = await newAccount()
    renderContato(account)
    expect(screen.getByText(`A resposta vai para ${account.email}.`)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Assunto'), 'correcao')
    await userEvent.type(screen.getByLabelText('Mensagem'), 'O CPF certo é outro.')
    await send()

    expect(await screen.findByText('Pedido enviado. Você recebe a resposta por e-mail.')).toBeInTheDocument()
    const list = within(screen.getByRole('region', { name: 'Seus pedidos' }))
    expect(list.getByText('Corrigir meus dados')).toBeInTheDocument()
    expect(list.getByText('Aguardando resposta')).toBeInTheDocument()
    expect(await dbRows('select assunto, mensagem from public.pedidos where conta_id = $1', account.id)).toEqual([
      { assunto: 'correcao', mensagem: 'O CPF certo é outro.' },
    ])
    // O formulário volta vazio
    expect(screen.getByLabelText('Mensagem')).toHaveValue('')
  })

  it('sem assunto ou sem mensagem, avisa no campo e não grava', async () => {
    const account = await newAccount()
    renderContato(account)
    await send()
    expect(screen.getByLabelText('Assunto')).toHaveAccessibleDescription('Escolha o assunto.')
    expect(screen.getByLabelText('Assunto')).toHaveFocus()

    await userEvent.selectOptions(screen.getByLabelText('Assunto'), 'acesso')
    await userEvent.type(screen.getByLabelText('Mensagem'), '   ')
    await send()
    expect(screen.getByLabelText('Mensagem')).toHaveAccessibleDescription('Escreva o seu pedido.')
    expect(screen.getByLabelText('Mensagem')).toHaveFocus()
    expect(await dbRow('select count(*) as n from public.pedidos')).toEqual({ n: 0 })
  })

  it('lista os pedidos já enviados, com a data da resposta', async () => {
    const account = await newAccount()
    const sent = await sendDataRequest('acesso', 'Quero ver meus dados.')
    await dbRow("update public.pedidos set respondido_em = '2026-11-12T15:00:00Z' where id = $1 returning id", sent.id)
    renderContato(account)
    const list = within(await screen.findByRole('region', { name: 'Seus pedidos' }))
    expect(list.getByText('Ver quais dados vocês têm sobre mim')).toBeInTheDocument()
    expect(list.getByText(/^Respondido em 12 de nov\. de 2026/)).toBeInTheDocument()
  })

  it('mostra o aviso do banco quando há pedidos demais esperando resposta', async () => {
    const account = await newAccount()
    for (let i = 0; i < 5; i++) await sendDataRequest('duvida', `Pedido ${i}`)
    renderContato(account)
    await userEvent.selectOptions(screen.getByLabelText('Assunto'), 'duvida')
    await userEvent.type(screen.getByLabelText('Mensagem'), 'Mais um')
    await send()
    await waitFor(() => expect(screen.getByText(/5 pedidos esperando resposta/)).toBeInTheDocument())
  })
})
