import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Account } from '../features/conta/usuario'
import { apiServer, dbRow, dbRows, loginAs, newAccount, readyProvider } from '../test/api-server'
import { Servicos } from './Servicos'

function renderServicos(account?: Account) {
  const onAccountChange = vi.fn()
  const view = render(<Servicos account={account} onLogin={vi.fn()} onAccountChange={onAccountChange} />)
  return { onAccountChange, ...view }
}

const painel = () => screen.findByRole('heading', { name: 'Serviços', level: 1 })
// O formulário "Sobre seu trabalho" também tem um botão Salvar
const editor = () => within(screen.getByLabelText('Serviço').closest('form')!)
const servicesOf = (professionalId: string) =>
  dbRows('SELECT profession_id, name, price FROM services WHERE professional_id = ? ORDER BY position', professionalId)

async function addService(name: string, price = '') {
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
  await userEvent.selectOptions(screen.getByLabelText('Profissão'), 'eletricista')
  await userEvent.type(screen.getByLabelText('Serviço'), name)
  if (price) await userEvent.type(screen.getByLabelText(/^Preço médio/), price)
  await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(screen.queryByLabelText('Serviço')).not.toBeInTheDocument())
}

describe('Servicos: quem ainda não oferece', () => {
  it('sem login pede para entrar', async () => {
    renderServicos()
    expect(await screen.findByText('Entre para cadastrar seus serviços.')).toBeInTheDocument()
  })

  it('vira prestador e o perfil é criado no banco', async () => {
    const account = await newAccount()
    const { onAccountChange } = renderServicos(account)
    await userEvent.click(screen.getByRole('button', { name: 'Quero oferecer serviços' }))

    await waitFor(() => expect(onAccountChange).toHaveBeenCalled())
    const updated = onAccountChange.mock.calls[0][0] as Account
    expect(updated.professionalId).toBeDefined()
    expect(dbRow('SELECT status FROM professionals WHERE account_id = ?', account.id)?.status).toBe('rascunho')
  })
})

describe('Servicos: meus serviços gravados no banco', () => {
  it('adiciona, edita, apaga e desfaz, sempre conferindo o banco', async () => {
    const account = await newAccount({ asProvider: true })
    renderServicos(account)
    await painel()

    await addService('Instalar ventilador', '120')
    expect(screen.getByText(/média R\$\s120/)).toBeInTheDocument()
    expect(servicesOf(account.professionalId!)).toEqual([
      { profession_id: 'eletricista', name: 'Instalar ventilador', price: 120 },
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Editar Instalar ventilador' }))
    await userEvent.clear(screen.getByLabelText(/^Preço médio/))
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('a combinar')).toBeInTheDocument()
    expect(servicesOf(account.professionalId!)[0].price).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Apagar Instalar ventilador' }))
    expect(await screen.findByText(/Instalar ventilador apagado/)).toBeInTheDocument()
    expect(servicesOf(account.professionalId!)).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('button', { name: 'Editar Instalar ventilador' })).toBeInTheDocument()
    expect(servicesOf(account.professionalId!)).toHaveLength(1)
  })

  it('recusa serviço sem nome ou repetido na mesma profissão', async () => {
    renderServicos(await newAccount({ asProvider: true }))
    await painel()
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Informe o nome do serviço.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await addService('Instalar chuveiro')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
    await userEvent.selectOptions(screen.getByLabelText('Profissão'), 'eletricista')
    await userEvent.type(screen.getByLabelText('Serviço'), 'instalar CHUVEIRO')
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Você já tem um serviço com esse nome nesta profissão.')).toBeInTheDocument()
  })

  it('mantém o editor aberto e avisa se o servidor recusar', async () => {
    const account = await newAccount({ asProvider: true })
    renderServicos(account)
    await painel()
    // A modalidade some do banco enquanto a tela está aberta
    const { apiServer } = await import('../test/api-server')
    apiServer().db.prepare(`DELETE FROM professions WHERE id = 'pintor'`).run()

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
    await userEvent.selectOptions(screen.getByLabelText('Profissão'), 'pintor')
    await userEvent.type(screen.getByLabelText('Serviço'), 'Pintar muro')
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Escolha uma profissão do catálogo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Serviço')).toHaveValue('Pintar muro')
    expect(servicesOf(account.professionalId!)).toHaveLength(0)
  })

  it('grava o texto "Sobre seu trabalho"', async () => {
    const account = await newAccount({ asProvider: true })
    renderServicos(account)
    await painel()
    await userEvent.type(screen.getByLabelText('Sobre seu trabalho'), '  Atendo a região sul. ')
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1)!)
    expect(await screen.findByText('Texto salvo.')).toBeInTheDocument()
    expect(dbRow('SELECT about FROM professionals WHERE account_id = ?', account.id)?.about).toBe('Atendo a região sul.')
  })
})

describe('Servicos: publicação', () => {
  it('só libera publicar com foto, WhatsApp e pelo menos um serviço', async () => {
    renderServicos(await newAccount({ asProvider: true }))
    await painel()
    const card = within(screen.getByRole('region', { name: 'Seu perfil ainda não aparece nas buscas' }))
    expect(card.getByRole('button', { name: 'Publicar' })).toBeDisabled()
    expect(card.getByRole('link', { name: 'Foto no Perfil' })).toHaveAttribute('href', '#/conta')
    expect(card.getByRole('link', { name: 'WhatsApp cadastrado no Perfil' })).toHaveAttribute('href', '#/conta')

    await addService('Instalar tomada')
    expect(card.getByRole('button', { name: 'Publicar' })).toBeDisabled()
  })

  it('com tudo pronto, o botão leva para a tela de publicar', async () => {
    renderServicos(await readyProvider())
    await painel()
    const card = within(screen.getByRole('region', { name: 'Seu perfil ainda não aparece nas buscas' }))
    expect(card.getByRole('link', { name: 'Publicar' })).toHaveAttribute('href', '#/publicar')
  })
})

describe('Servicos: perfil publicado', () => {
  it('mostra o plano e pede o WhatsApp', async () => {
    apiServer().db.prepare(`UPDATE professionals SET whatsapp = '' WHERE id = 'p1'`).run()
    renderServicos(await loginAs('carlos@exemplo.com'))
    expect(await screen.findByText(/Perfil publicado\. Plano mensal/)).toBeInTheDocument()
    expect(screen.getByText(/Cadastre seu WhatsApp no/)).toBeInTheDocument()
  })

  it('lista os contatos do banco e grava "respondido"', async () => {
    renderServicos(await loginAs('carlos@exemplo.com'))
    await painel()
    await userEvent.click(screen.getByRole('button', { name: /Contatos/ }))

    expect(screen.getByLabelText('2 novos')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Marcar como respondido' })[0])
    await waitFor(() => expect(screen.getAllByText('Novo')).toHaveLength(1))
    expect(dbRow(`SELECT count(*) AS n FROM contacts WHERE answered = 0`)?.n).toBe(1)
  })

  it('mostra a nota e os comentários', async () => {
    renderServicos(await loginAs('carlos@exemplo.com'))
    await painel()
    await userEvent.click(screen.getByRole('button', { name: 'Avaliações' }))
    expect(screen.getByText('4,9', { selector: '.score-value' })).toBeInTheDocument()
    expect(screen.getByText('Fernanda')).toBeInTheDocument()
  })
})
