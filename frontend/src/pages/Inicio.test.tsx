import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { apiServer, loginAs } from '../test/api-server'
import { Inicio } from './Inicio'

type Props = Partial<Parameters<typeof Inicio>[0]>

async function renderInicio(props: Props = {}) {
  const handlers = { onLogin: vi.fn(), onLogout: vi.fn() }
  render(<Inicio isLoggedIn={false} isAdmin={false} userName="" {...handlers} {...props} />)
  // O catálogo vem do banco
  await screen.findByRole('button', { name: 'Eletricista' })
  return handlers
}

const sheet = () => within(document.querySelector('dialog')!)

async function openTask(title: string) {
  await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar serviço' }), title)
  await userEvent.click(screen.getByRole('button', { name: new RegExp(title) }))
  await sheet().findByRole('combobox', { name: 'Ordenar por' })
}

describe('Inicio: busca', () => {
  it('pede para escolher uma profissão antes de listar serviços', async () => {
    await renderInicio()
    expect(screen.getByText('Escolha uma ou mais profissões e toque em Exibir.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exibir' })).not.toBeInTheDocument()
  })

  it('mostra as modalidades gravadas no banco, inclusive as novas', async () => {
    apiServer()
      .db.prepare(`INSERT INTO professions (id, name, tasks, position) VALUES ('vidraceiro', 'Vidraceiro', '["Trocar vidro"]', 9)`)
      .run()
    await renderInicio()
    await userEvent.click(screen.getByRole('button', { name: 'Vidraceiro' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exibir' }))
    expect(screen.getByRole('button', { name: /Trocar vidro/ })).toBeInTheDocument()
  })

  it('escolher a profissão só mostra o Exibir; a lista abre em outra tela', async () => {
    await renderInicio()
    await userEvent.click(screen.getByRole('button', { name: 'Eletricista', pressed: false }))
    expect(screen.queryByRole('button', { name: /Instalar chuveiro/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Exibir' }))
    expect(screen.getByRole('button', { name: /Instalar chuveiro/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eletricista' })).not.toBeInTheDocument()

    // Volta com a escolha mantida; tocar de novo na profissão tira a seleção
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para as profissões' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Eletricista', pressed: true }))
    expect(screen.getByText('Escolha uma ou mais profissões e toque em Exibir.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exibir' })).not.toBeInTheDocument()
  })

  it('exibe juntos os serviços de mais de uma profissão', async () => {
    await renderInicio()
    await userEvent.click(screen.getByRole('button', { name: 'Eletricista' }))
    await userEvent.click(screen.getByRole('button', { name: 'Jardineiro' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exibir' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Eletricista e Jardineiro' })).toBeInTheDocument()

    // Um grupo por profissão, cada um com os próprios serviços
    const eletricista = within(screen.getByRole('region', { name: 'Eletricista' }))
    expect(eletricista.getByRole('button', { name: /Instalar chuveiro/ })).toBeInTheDocument()
    expect(eletricista.queryByRole('button', { name: /Plantar grama/ })).not.toBeInTheDocument()
    const jardineiro = within(screen.getByRole('region', { name: 'Jardineiro' }))
    expect(jardineiro.getByRole('button', { name: /Plantar grama/ })).toBeInTheDocument()
  })

  it('busca sem diferenciar acentos', async () => {
    await renderInicio()
    await userEvent.type(screen.getByRole('searchbox'), 'PORTAO')
    expect(screen.getByRole('heading', { level: 2, name: '1 serviço' })).toBeInTheDocument()
  })

  it('avisa quando nada é encontrado e limpa a busca', async () => {
    await renderInicio()
    await userEvent.type(screen.getByRole('searchbox'), 'xyzxyz')
    expect(screen.getByText('Nenhum serviço encontrado para essa busca.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('ao tocar na busca abre o card de resultados, e o X volta ao início', async () => {
    await renderInicio()
    expect(screen.queryByRole('region', { name: 'Resultados da busca' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('searchbox', { name: 'Buscar serviço' }))
    const card = within(screen.getByRole('region', { name: 'Resultados da busca' }))
    expect(card.getByText(/Digite o serviço que você procura/)).toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox'), 'chuveiro')
    expect(card.getByRole('button', { name: /Instalar chuveiro/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar busca' }))
    expect(screen.queryByRole('region', { name: 'Resultados da busca' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByText('Escolha uma ou mais profissões e toque em Exibir.')).toBeInTheDocument()
  })

  it('a busca procura em todos os serviços, mesmo com profissão escolhida', async () => {
    await renderInicio()
    await userEvent.click(screen.getByRole('button', { name: 'Eletricista' }))
    await userEvent.type(screen.getByRole('searchbox'), 'grama')
    expect(screen.getByRole('button', { name: /Plantar grama/ })).toBeInTheDocument()
  })

  it('mostra erro e permite tentar de novo quando o servidor falha', async () => {
    const realFetch = globalThis.fetch
    let fail = true
    vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) =>
      fail ? Promise.reject(new TypeError('offline')) : realFetch(...args),
    )
    render(<Inicio isLoggedIn={false} isAdmin={false} userName="" onLogin={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText(/Não foi possível falar com o servidor/)).toBeInTheDocument()

    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('button', { name: 'Eletricista' })).toBeInTheDocument()
  })
})

describe('Inicio: profissionais', () => {
  it('sem login: o servidor não manda preço nem sobrenome', async () => {
    const { onLogin } = await renderInicio()
    await openTask('Instalar chuveiro')

    expect(sheet().getByRole('button', { name: /^Carlos/ })).toBeInTheDocument()
    expect(sheet().queryByText(/Carlos Henrique/)).not.toBeInTheDocument()
    expect(sheet().queryByText(/R\$\s150/)).not.toBeInTheDocument()
    expect(sheet().getAllByText('preço visível após entrar').length).toBeGreaterThan(0)

    await userEvent.click(sheet().getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('com login mostra nome completo, preço e o contato', async () => {
    apiServer().db.prepare(`UPDATE professionals SET whatsapp = '' WHERE id = 'p1'`).run()
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')

    await userEvent.click(sheet().getByRole('button', { name: /Carlos Henrique/ }))
    expect(sheet().getByRole('heading', { name: 'Carlos Henrique' })).toBeInTheDocument()
    expect(sheet().getByText(/R\$\s150/, { selector: '.price-value' })).toBeInTheDocument()

    await userEvent.click(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(sheet().getByText(/Carlos ainda não cadastrou o WhatsApp/)).toBeInTheDocument()
  })

  it('abre o WhatsApp com o número gravado no banco', async () => {
    apiServer().db.prepare(`UPDATE professionals SET whatsapp = '62988887777' WHERE id = 'p1'`).run()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')
    await userEvent.click(sheet().getByRole('button', { name: /Carlos Henrique/ }))
    await userEvent.click(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5562988887777\?text=/), '_blank', 'noopener,noreferrer')
  })

  it('abre o WhatsApp direto da lista, sem abrir o perfil', async () => {
    apiServer().db.prepare(`UPDATE professionals SET whatsapp = '62988887777' WHERE id = 'p1'`).run()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')
    await userEvent.click(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5562988887777\?text=/), '_blank', 'noopener,noreferrer')
  })

  it('sem login a lista mostra o WhatsApp desfocado e o toque leva ao login', async () => {
    apiServer().db.prepare(`UPDATE professionals SET whatsapp = '62988887777' WHERE id = 'p1'`).run()
    const { onLogin } = await renderInicio()
    await openTask('Instalar chuveiro')
    expect(sheet().queryByText(/98888-7777/)).not.toBeInTheDocument()
    const locked = sheet().getAllByRole('button', { name: 'WhatsApp visível após entrar' })
    expect(locked.length).toBeGreaterThan(0)
    await userEvent.click(locked[0])
    expect(onLogin).toHaveBeenCalled()
  })

  // Nomes na ordem em que estão na lista
  const listed = () => [...document.querySelectorAll('dialog .pro-name')].map((el) => el.textContent)

  it('ordena por avaliação, nome, menor e maior valor ("a combinar" no fim)', async () => {
    apiServer().db.prepare(`UPDATE professionals SET name = 'Wagner Lima' WHERE id = 'p1'`).run()
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')
    expect(listed()).toEqual(['Wagner Lima', 'Marcos Vinícius', 'Rafael Souza'])

    const sortBy = sheet().getByRole('combobox', { name: 'Ordenar por' })
    await userEvent.selectOptions(sortBy, 'nome')
    expect(listed()).toEqual(['Marcos Vinícius', 'Rafael Souza', 'Wagner Lima'])

    // Wagner R$ 150, Marcos R$ 120, Rafael a combinar
    await userEvent.selectOptions(sortBy, 'menor-valor')
    expect(listed()).toEqual(['Marcos Vinícius', 'Wagner Lima', 'Rafael Souza'])

    await userEvent.selectOptions(sortBy, 'maior-valor')
    expect(listed()).toEqual(['Wagner Lima', 'Marcos Vinícius', 'Rafael Souza'])
  })

  it('procura profissional por nome, sem ligar para acento e maiúscula', async () => {
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')
    const search = sheet().getByRole('searchbox', { name: 'Procurar profissional por nome' })

    await userEvent.type(search, 'vinicius')
    expect(listed()).toEqual(['Marcos Vinícius'])

    await userEvent.clear(search)
    await userEvent.type(search, 'xyz')
    expect(sheet().getByText('Nenhum profissional com esse nome.')).toBeInTheDocument()
  })

  it('sem login não ordena por valor e procura só pelo primeiro nome', async () => {
    await renderInicio()
    await openTask('Instalar chuveiro')
    expect(sheet().getByRole('option', { name: 'Menor valor (entre para ver)' })).toBeDisabled()
    expect(sheet().getByRole('option', { name: 'Maior valor (entre para ver)' })).toBeDisabled()

    await userEvent.type(sheet().getByRole('searchbox', { name: 'Procurar profissional por nome' }), 'souza')
    expect(sheet().getByText('Nenhum profissional com esse nome.')).toBeInTheDocument()
  })

  it('rascunho não aparece na lista', async () => {
    apiServer().db.prepare(`UPDATE professionals SET status = 'rascunho' WHERE id = 'p1'`).run()
    await renderInicio()
    await openTask('Instalar chuveiro')
    expect(sheet().queryByRole('button', { name: /^Carlos/ })).not.toBeInTheDocument()
  })

  it('serviço sem profissionais avisa', async () => {
    apiServer().db.prepare(`DELETE FROM services WHERE name = 'Plantar grama'`).run()
    await renderInicio()
    await userEvent.type(screen.getByRole('searchbox'), 'Plantar grama')
    await userEvent.click(screen.getByRole('button', { name: /Plantar grama/ }))
    expect(await sheet().findByText('Ainda não há profissionais para este serviço.')).toBeInTheDocument()
  })
})

describe('Inicio: cabeçalho', () => {
  it('cumprimenta pelo primeiro nome e permite sair', async () => {
    const { onLogout } = await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    expect(screen.getByText(/, Beatriz$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('mostra o atalho da administração só para admin', async () => {
    await renderInicio({ isLoggedIn: true, isAdmin: true, userName: 'Administração' })
    expect(screen.getByRole('link', { name: 'Administração' })).toBeInTheDocument()
  })
})
