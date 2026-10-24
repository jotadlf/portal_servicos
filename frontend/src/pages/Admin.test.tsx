import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { dbRow, loginAs, PNG_FILE } from '../test/supabase'
import { Admin } from './Admin'

async function openTab(name?: string) {
  render(<Admin account={await loginAs('admin@exemplo.com')} onLogin={vi.fn()} />)
  if (name) await userEvent.click(screen.getByRole('button', { name }))
}

describe('Admin: acesso', () => {
  it('sem login pede a conta de administração', () => {
    render(<Admin onLogin={vi.fn()} />)
    expect(screen.getByText('Entre com a conta de administração.')).toBeInTheDocument()
  })

  it('bloqueia quem não administra', async () => {
    render(<Admin account={await loginAs('beatriz@exemplo.com')} onLogin={vi.fn()} />)
    expect(screen.getByText('Esta área é só para a administração do portal.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Painel' })).not.toBeInTheDocument()
  })
})

describe('Admin: painel com números do banco', () => {
  it('mostra os números e os gráficos', async () => {
    await openTab()
    const kpis = within(await screen.findByRole('region', { name: 'Números de agora' }))
    expect(kpis.getByText('Pessoas').nextSibling).toHaveTextContent('25')
    expect(kpis.getByText('Prestadores publicados').nextSibling).toHaveTextContent('24')
    expect(screen.getByRole('region', { name: 'Prestadores' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Top modalidades' })).toHaveTextContent('Eletricista')
  })

  it('mostra só as 5 modalidades com mais serviços', async () => {
    await openTab()
    const top = await screen.findByRole('region', { name: 'Top modalidades' })
    expect(within(top).getAllByRole('listitem')).toHaveLength(5)
  })
})

describe('Admin: modalidades gravadas no banco', () => {
  const fill = async (name: string, tasks: string) => {
    await userEvent.type(await screen.findByLabelText('Nome'), name)
    if (tasks) await userEvent.type(screen.getByLabelText(/Serviços sugeridos/), tasks)
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar modalidade' }))
  }

  it('adiciona uma modalidade nova com imagem', async () => {
    await openTab('Modalidades')
    await userEvent.upload(await screen.findByLabelText('Imagem da modalidade'), PNG_FILE())
    await fill('Marceneiro', 'Montar móvel{Enter}{Enter}Consertar porta')

    expect(await screen.findByText('Marceneiro já aparece na página inicial.')).toBeInTheDocument()
    const saved = await dbRow(`select name, tasks, image from public.professions where id = 'marceneiro'`)
    expect(saved).toMatchObject({ name: 'Marceneiro', tasks: ['Montar móvel', 'Consertar porta'] })
    expect(saved?.image).toMatch(/^modalidades\//)
    expect(await screen.findByText('10 modalidades no catálogo')).toBeInTheDocument()
  })

  it('valida nome, números, duplicidade e serviços', async () => {
    await openTab('Modalidades')
    await screen.findByLabelText('Nome')
    const submit = screen.getByRole('button', { name: 'Adicionar modalidade' })

    await userEvent.click(submit)
    expect(screen.getByText('Informe o nome da modalidade.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nome'), 'eletricista')
    await userEvent.click(submit)
    expect(screen.getByText('Já existe uma modalidade com esse nome.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Pedreiro 2')
    await userEvent.click(submit)
    expect(screen.getByText(/Use só letras no nome da modalidade/)).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Vidraceiro')
    await userEvent.click(submit)
    expect(screen.getByText(/Informe pelo menos um serviço/)).toBeInTheDocument()
    expect((await dbRow('select count(*) as n from public.professions'))?.n).toBe(9)
  })

  it('recusa imagem SVG', async () => {
    await openTab('Modalidades')
    await userEvent.upload(
      await screen.findByLabelText('Imagem da modalidade'),
      new File(['<svg/>'], 'icone.svg', { type: 'image/svg+xml' }),
      { applyAccept: false },
    )
    expect(screen.getByText('Escolha uma imagem PNG ou WebP.')).toBeInTheDocument()
  })

  it('remove só depois de confirmar e apaga os serviços junto', async () => {
    await openTab('Modalidades')
    await userEvent.click(await screen.findByRole('button', { name: 'Remover Eletricista' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect((await dbRow(`select count(*) as n from public.professions where id = 'eletricista'`))?.n).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Remover Eletricista' }))
    await userEvent.click(screen.getByRole('button', { name: /^Remover e apagar \d+ serviços$/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remover Eletricista' })).not.toBeInTheDocument())
    expect((await dbRow(`select count(*) as n from public.services where profession_id = 'eletricista'`))?.n).toBe(0)
  })
})

describe('Admin: plano e pagamentos gravados no banco', () => {
  it('salva os novos valores do plano', async () => {
    await openTab('Plano e pagamentos')
    const monthly = await screen.findByLabelText('Mensal (R$)')
    await userEvent.clear(monthly)
    await userEvent.type(monthly, '25,00')
    expect(screen.getByText(/O semestral sai 33% mais barato/)).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Dias grátis ao publicar'))
    await userEvent.type(screen.getByLabelText('Dias grátis ao publicar'), '30')
    await userEvent.selectOptions(screen.getByLabelText('Gateway de pagamento'), 'stripe')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    expect(await screen.findByText(/Configurações salvas/)).toBeInTheDocument()
    expect((await dbRow('select monthly_price, trial_days, gateway from public.plan_settings'))).toEqual({
      monthly_price: 25,
      trial_days: 30,
      gateway: 'stripe',
    })
  })

  it('aceita preço com separador de milhar ("1.234,50")', async () => {
    await openTab('Plano e pagamentos')
    const semiannual = await screen.findByLabelText('Semestral (R$)')
    await userEvent.clear(semiannual)
    await userEvent.type(semiannual, '1.234,50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    await screen.findByText(/Configurações salvas/)
    expect((await dbRow('select semiannual_price from public.plan_settings'))?.semiannual_price).toBe(1234.5)
  })

  // Achado da exploração: "19.90" era gravado como 1990
  it.each([
    ['19.90', 19.9],
    ['19,90', 19.9],
    ['25', 25],
  ])('entende "%s" como R$ %s', async (typed, expected) => {
    await openTab('Plano e pagamentos')
    const monthly = await screen.findByLabelText('Mensal (R$)')
    await userEvent.clear(monthly)
    await userEvent.type(monthly, typed)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    await screen.findByText(/Configurações salvas/)
    expect((await dbRow('select monthly_price from public.plan_settings'))?.monthly_price).toBe(expected)
  })

  it('recusa preço ambíguo ("1.234" sem vírgula)', async () => {
    await openTab('Plano e pagamentos')
    const monthly = await screen.findByLabelText('Mensal (R$)')
    await userEvent.clear(monthly)
    await userEvent.type(monthly, '1.234')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    expect(screen.getByText(/Informe os preços em reais/)).toBeInTheDocument()
  })

  it('recusa preço inválido, período longo e nenhuma forma de pagamento', async () => {
    await openTab('Plano e pagamentos')
    const monthly = await screen.findByLabelText('Mensal (R$)')
    const submit = screen.getByRole('button', { name: 'Salvar configurações' })

    await userEvent.clear(monthly)
    await userEvent.type(monthly, 'abc')
    await userEvent.click(submit)
    expect(screen.getByText(/Informe os preços em reais/)).toBeInTheDocument()

    await userEvent.clear(monthly)
    await userEvent.type(monthly, '19,90')
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
    expect((await dbRow('select monthly_price, trial_days from public.plan_settings'))).toEqual({ monthly_price: 19.9, trial_days: 15 })
  })
})
