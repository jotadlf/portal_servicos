import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPlanSettings, updatePlanSettings } from '../features/conta/plano'
import { getAccount } from '../features/conta/usuario'
import { findProfession } from '../features/servicos/catalogo'
import { Admin } from './Admin'

const originalSettings = { ...getPlanSettings() }
afterEach(() => updatePlanSettings(originalSettings))

const admin = () => getAccount('u3')!

async function openTab(name: string) {
  render(<Admin account={admin()} onLogin={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name }))
}

describe('Admin: acesso', () => {
  it('sem login pede a conta de administração', () => {
    render(<Admin onLogin={vi.fn()} />)
    expect(screen.getByText('Entre com a conta de administração.')).toBeInTheDocument()
  })

  it('bloqueia quem não administra', () => {
    render(<Admin account={getAccount('u2')} onLogin={vi.fn()} />)
    expect(screen.getByText('Esta área é só para a administração do portal.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  })
})

describe('Admin: painel', () => {
  it('mostra os números e os gráficos', () => {
    render(<Admin account={admin()} onLogin={vi.fn()} />)
    const kpis = within(screen.getByRole('region', { name: 'Números de agora' }))
    expect(kpis.getByText('Pessoas cadastradas')).toBeInTheDocument()
    expect(kpis.getByText('Receita mensal recorrente')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Novos cadastros por mês' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Serviços por modalidade' })).toHaveTextContent('Eletricista')
  })

  it('troca o período dos gráficos', async () => {
    render(<Admin account={admin()} onLogin={vi.fn()} />)
    expect(screen.getByRole('button', { name: '6 meses' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '12 meses' }))
    expect(screen.getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Admin: modalidades', () => {
  it('adiciona uma modalidade nova', async () => {
    await openTab('Modalidades')
    await userEvent.type(screen.getByLabelText('Nome'), 'Marceneiro')
    await userEvent.type(screen.getByLabelText(/Serviços sugeridos/), 'Montar móvel{Enter}{Enter}Consertar porta')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar modalidade' }))

    expect(screen.getByText('Marceneiro já aparece na página inicial.')).toBeInTheDocument()
    expect(findProfession('marceneiro')?.tasks).toEqual(['Montar móvel', 'Consertar porta'])
    expect(screen.getByLabelText('Nome')).toHaveValue('')
  })

  it('valida nome, duplicidade e serviços', async () => {
    await openTab('Modalidades')
    const submit = screen.getByRole('button', { name: 'Adicionar modalidade' })

    await userEvent.click(submit)
    expect(screen.getByText('Informe o nome da modalidade.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nome'), 'eletricista')
    await userEvent.click(submit)
    expect(screen.getByText('Já existe uma modalidade com esse nome.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Vidraceiro')
    await userEvent.click(submit)
    expect(screen.getByText(/Informe pelo menos um serviço/)).toBeInTheDocument()
  })

  it('remove só depois de confirmar', async () => {
    await openTab('Modalidades')
    await userEvent.type(screen.getByLabelText('Nome'), 'Dedetizador')
    await userEvent.type(screen.getByLabelText(/Serviços sugeridos/), 'Dedetizar casa')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar modalidade' }))

    await userEvent.click(screen.getByRole('button', { name: 'Remover Dedetizador' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(findProfession('dedetizador')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Remover Dedetizador' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(findProfession('dedetizador')).toBeUndefined()
    expect(screen.queryByText('Dedetizador')).not.toBeInTheDocument()
  })

  it('avisa quantos serviços somem junto com a modalidade', async () => {
    await openTab('Modalidades')
    await userEvent.click(screen.getByRole('button', { name: 'Remover Eletricista' }))
    expect(screen.getByRole('button', { name: /^Remover e apagar \d+ serviços$/ })).toBeInTheDocument()
  })
})

describe('Admin: plano e pagamentos', () => {
  it('salva os novos valores do plano', async () => {
    await openTab('Plano e pagamentos')
    await userEvent.clear(screen.getByLabelText('Mensal (R$)'))
    await userEvent.type(screen.getByLabelText('Mensal (R$)'), '25,00')
    expect(screen.getByText(/O semestral sai 33% mais barato/)).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Dias grátis ao publicar'))
    await userEvent.type(screen.getByLabelText('Dias grátis ao publicar'), '30')
    await userEvent.selectOptions(screen.getByLabelText('Gateway de pagamento'), 'stripe')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    expect(screen.getByText(/Configurações salvas nesta sessão/)).toBeInTheDocument()
    expect(getPlanSettings()).toMatchObject({ monthlyPrice: 25, trialDays: 30, gateway: 'stripe' })
  })

  it('avisa quando o semestral não compensa', async () => {
    await openTab('Plano e pagamentos')
    await userEvent.clear(screen.getByLabelText('Semestral (R$)'))
    await userEvent.type(screen.getByLabelText('Semestral (R$)'), '200')
    expect(screen.getByText(/o semestral não está mais barato/)).toBeInTheDocument()
  })

  it('recusa preço inválido, período longo e nenhuma forma de pagamento', async () => {
    await openTab('Plano e pagamentos')
    const submit = screen.getByRole('button', { name: 'Salvar configurações' })

    await userEvent.clear(screen.getByLabelText('Mensal (R$)'))
    await userEvent.type(screen.getByLabelText('Mensal (R$)'), 'abc')
    await userEvent.click(submit)
    expect(screen.getByText(/Informe os preços em reais/)).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Mensal (R$)'))
    await userEvent.type(screen.getByLabelText('Mensal (R$)'), '19,90')
    await userEvent.clear(screen.getByLabelText('Dias grátis ao publicar'))
    await userEvent.type(screen.getByLabelText('Dias grátis ao publicar'), '99')
    await userEvent.click(submit)
    expect(screen.getByText('O período grátis precisa ser de 0 a 90 dias.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Dias grátis ao publicar'))
    await userEvent.type(screen.getByLabelText('Dias grátis ao publicar'), '15')
    await userEvent.click(screen.getByRole('checkbox', { name: /Pix/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cartão de crédito' }))
    await userEvent.click(submit)
    expect(screen.getByText('Deixe pelo menos uma forma de pagamento ligada.')).toBeInTheDocument()
    expect(getPlanSettings()).toEqual(originalSettings)
  })
})
