import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { dbExec, loginAs } from '../test/supabase'
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

  it('mostra as modalidades novas assim que algum prestador publicado oferece o serviço', async () => {
    await dbExec(`INSERT into public.modalidades (id, nome, sugestoes, posicao) VALUES ('vidraceiro', 'Vidraceiro', '{"Trocar vidro","Instalar box"}', 9)`)
    await dbExec(`INSERT into public.servicos (prestador_id, modalidade_id, nome, posicao) VALUES ('p1', 'vidraceiro', 'Trocar vidro', 9)`)
    await renderInicio()
    await userEvent.click(screen.getByRole('button', { name: 'Vidraceiro' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exibir' }))
    expect(screen.getByRole('button', { name: /Trocar vidro/ })).toBeInTheDocument()
    // Sugestão que nenhum prestador oferece não aparece
    expect(screen.queryByRole('button', { name: /Instalar box/ })).not.toBeInTheDocument()
  })

  it('modalidade sem prestador publicado não aparece', async () => {
    await dbExec(`INSERT into public.modalidades (id, nome, sugestoes, posicao) VALUES ('vidraceiro', 'Vidraceiro', '{"Trocar vidro"}', 9)`)
    await dbExec(`update public.prestadores set status = 'rascunho' where id = 'p23'`)
    await dbExec(`delete from public.servicos where prestador_id = 'p24'`)
    await renderInicio()
    expect(screen.queryByRole('button', { name: 'Vidraceiro' })).not.toBeInTheDocument()
    // Chaveiro: um prestador virou rascunho e o outro não tem mais serviços
    expect(screen.queryByRole('button', { name: 'Chaveiro' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eletricista' })).toBeInTheDocument()
  })

  it('sem nenhum serviço oferecido, avisa que o portal ainda está vazio', async () => {
    await dbExec(`update public.prestadores set status = 'rascunho'`)
    // Sem renderInicio: ele espera o card de Eletricista, que aqui não aparece
    render(<Inicio isLoggedIn={false} isAdmin={false} userName="" onLogin={vi.fn()} onLogout={vi.fn()} />)
    expect(await screen.findByText('Ainda não há serviços no portal. Volte em breve.')).toBeInTheDocument()
    expect(screen.queryByText('Escolha uma ou mais profissões e toque em Exibir.')).not.toBeInTheDocument()
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
    await dbExec(`update public.prestadores set whatsapp = '' where id = 'p1'`)
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
    await dbExec(`update public.prestadores set whatsapp = '62988887777' where id = 'p1'`)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')
    await userEvent.click(sheet().getByRole('button', { name: /Carlos Henrique/ }))
    await userEvent.click(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5562988887777\?text=/), '_blank', 'noopener,noreferrer')
  })

  it('abre o WhatsApp direto da lista, sem abrir o perfil', async () => {
    await dbExec(`update public.prestadores set whatsapp = '62988887777' where id = 'p1'`)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderInicio({ isLoggedIn: true, userName: 'Beatriz Rocha' })
    await openTask('Instalar chuveiro')
    await userEvent.click(sheet().getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5562988887777\?text=/), '_blank', 'noopener,noreferrer')
  })

  it('sem login a lista mostra o WhatsApp desfocado e o toque leva ao login', async () => {
    await dbExec(`update public.prestadores set whatsapp = '62988887777' where id = 'p1'`)
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
    await dbExec(`update public.prestadores set nome = 'Wagner Lima' where id = 'p1'`)
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
    await dbExec(`update public.prestadores set status = 'rascunho' where id = 'p1'`)
    await renderInicio()
    await openTask('Instalar chuveiro')
    expect(sheet().queryByRole('button', { name: /^Carlos/ })).not.toBeInTheDocument()
  })

  it('serviço que ninguém oferece não aparece na busca', async () => {
    await dbExec(`delete from public.servicos where nome = 'Plantar grama'`)
    await renderInicio()
    await userEvent.type(screen.getByRole('searchbox'), 'Plantar grama')
    expect(screen.getByText('Nenhum serviço encontrado para essa busca.')).toBeInTheDocument()
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
