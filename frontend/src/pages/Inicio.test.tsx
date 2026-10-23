import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Inicio } from './Inicio'

type Props = Partial<Parameters<typeof Inicio>[0]>

function renderInicio(props: Props = {}) {
  const handlers = { onLogin: vi.fn(), onLogout: vi.fn() }
  render(<Inicio isLoggedIn={false} isAdmin={false} userName="" {...handlers} {...props} />)
  return handlers
}

const sheet = () => within(document.querySelector('dialog')!)

async function openTask(title: string) {
  await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar serviço' }), title)
  await userEvent.click(screen.getByRole('button', { name: new RegExp(title) }))
}

describe('Inicio: busca', () => {
  it('pede para escolher uma profissão antes de listar serviços', () => {
    renderInicio()
    expect(screen.getByText('Escolha uma profissão para ver os serviços.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /serviço/ })).not.toBeInTheDocument()
  })

  it('filtra pela profissão escolhida e permite tirar o filtro', async () => {
    renderInicio()
    await userEvent.click(screen.getByRole('button', { name: 'Eletricista', pressed: false }))

    expect(screen.getByRole('button', { name: 'Eletricista', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Instalar chuveiro/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remover filtro Eletricista' }))
    expect(screen.getByText('Escolha uma profissão para ver os serviços.')).toBeInTheDocument()
  })

  it('busca sem diferenciar acentos', async () => {
    renderInicio()
    await userEvent.type(screen.getByRole('searchbox'), 'PORTAO')
    expect(screen.getByRole('heading', { level: 2, name: '1 serviço' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pintar portão/ })).toBeInTheDocument()
  })

  it('avisa quando nada é encontrado e limpa a busca', async () => {
    renderInicio()
    await userEvent.type(screen.getByRole('searchbox'), 'xyzxyz')
    expect(screen.getByText('Nenhum serviço encontrado para essa busca.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca e filtros' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })
})

describe('Inicio: profissionais', () => {
  it('sem login esconde preço e sobrenome e pede para entrar', async () => {
    const { onLogin } = renderInicio()
    await openTask('Instalar chuveiro')

    expect(sheet().getByRole('heading', { name: 'Instalar chuveiro' })).toBeInTheDocument()
    expect(sheet().getByRole('button', { name: /^Carlos/ })).toBeInTheDocument()
    expect(sheet().queryByText(/Carlos Henrique/)).not.toBeInTheDocument()
    expect(sheet().getAllByText('preço visível após entrar').length).toBeGreaterThan(0)

    await userEvent.click(sheet().getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('com login mostra nome completo, preço e o contato', async () => {
    renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')

    await userEvent.click(sheet().getByRole('button', { name: /Carlos Henrique/ }))
    expect(sheet().getByRole('heading', { name: 'Carlos Henrique' })).toBeInTheDocument()
    expect(sheet().getByText(/R\$\s150/, { selector: '.price-value' })).toBeInTheDocument()
    expect(sheet().getByRole('link', { name: 'Ver perfil completo' })).toHaveAttribute('href', '#/prestador/p1')

    // Os dados de exemplo não têm WhatsApp
    await userEvent.click(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(sheet().getByText(/Carlos ainda não cadastrou o WhatsApp/)).toBeInTheDocument()

    await userEvent.click(sheet().getByRole('button', { name: 'Voltar para a lista de profissionais' }))
    expect(sheet().getByText('Ordenados pela reputação.')).toBeInTheDocument()
  })

  it('sem login o botão do WhatsApp fica desativado', async () => {
    renderInicio()
    await openTask('Instalar chuveiro')
    await userEvent.click(sheet().getByRole('button', { name: /^Carlos/ }))
    expect(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' })).toBeDisabled()
  })
})

describe('Inicio: cabeçalho', () => {
  it('cumprimenta pelo primeiro nome e permite sair', async () => {
    const { onLogout } = renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    expect(screen.getByText(/, Beatriz$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('mostra o atalho da administração só para admin', () => {
    renderInicio({ isLoggedIn: true, isAdmin: true, userName: 'Administração' })
    expect(screen.getByRole('link', { name: 'Administração' })).toBeInTheDocument()
  })
})
