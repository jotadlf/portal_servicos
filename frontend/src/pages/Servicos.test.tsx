import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  createAccount,
  getAccount,
  getAccountProfessional,
  updateAccount,
  type Account,
} from '../features/conta/usuario'
import { Servicos } from './Servicos'

let counter = 0
function newAccount(asProvider: boolean): Account {
  counter += 1
  return createAccount({
    name: 'Ana Lima',
    email: `servicos${counter}@exemplo.com`,
    password: 'segredo',
    asProvider,
  })
}

const renderServicos = (account?: Account) => render(<Servicos account={account} onLogin={vi.fn()} />)

// O formulário "Sobre seu trabalho" também tem um botão Salvar
const editor = () => within(screen.getByLabelText('Serviço').closest('form')!)

async function addService(name: string, price = '') {
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
  await userEvent.selectOptions(screen.getByLabelText('Profissão'), 'eletricista')
  await userEvent.type(screen.getByLabelText('Serviço'), name)
  if (price) await userEvent.type(screen.getByLabelText(/^Preço médio/), price)
  await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
}

describe('Servicos: quem ainda não oferece', () => {
  it('sem login pede para entrar', () => {
    renderServicos()
    expect(screen.getByText('Entre para cadastrar seus serviços.')).toBeInTheDocument()
  })

  it('vira prestador com um toque', async () => {
    const account = newAccount(false)
    renderServicos(account)
    await userEvent.click(screen.getByRole('button', { name: 'Quero oferecer serviços' }))

    expect(screen.getByRole('heading', { name: 'Serviços', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Você ainda não oferece nenhum serviço/)).toBeInTheDocument()
    expect(getAccount(account.id)?.professionalId).toBeDefined()
  })
})

describe('Servicos: meus serviços', () => {
  it('só libera publicar com WhatsApp e pelo menos um serviço', async () => {
    const account = newAccount(true)
    renderServicos(account)
    const card = within(screen.getByRole('region', { name: 'Seu perfil ainda não aparece nas buscas' }))
    expect(card.getByRole('button', { name: 'Publicar' })).toBeDisabled()
    expect(card.getByRole('link', { name: 'WhatsApp cadastrado no Perfil' })).toHaveAttribute('href', '#/conta')

    updateAccount(account.id, { phone: '62999998888' })
    await addService('Instalar ventilador', '120')
    expect(card.getByRole('link', { name: 'Publicar' })).toHaveAttribute('href', '#/publicar')
  })

  it('adiciona, edita, apaga e desfaz', async () => {
    const account = newAccount(true)
    renderServicos(account)

    await addService('Instalar ventilador', '120')
    expect(screen.getByText(/média R\$\s120/)).toBeInTheDocument()
    expect(getAccountProfessional(account)?.services).toEqual([
      { professionId: 'eletricista', name: 'Instalar ventilador', price: 120 },
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Editar Instalar ventilador' }))
    await userEvent.clear(screen.getByLabelText(/^Preço médio/))
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('a combinar')).toBeInTheDocument()
    expect(getAccountProfessional(account)?.services[0].price).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Apagar Instalar ventilador' }))
    expect(screen.getByText(/Instalar ventilador apagado/)).toBeInTheDocument()
    expect(getAccountProfessional(account)?.services).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(screen.getByRole('button', { name: 'Editar Instalar ventilador' })).toBeInTheDocument()
    expect(getAccountProfessional(account)?.services).toHaveLength(1)
  })

  it('recusa serviço sem nome ou repetido na mesma profissão', async () => {
    renderServicos(newAccount(true))

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Informe o nome do serviço.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await addService('Instalar chuveiro')
    await addService('instalar CHUVEIRO')
    expect(screen.getByText('Você já tem um serviço com esse nome nesta profissão.')).toBeInTheDocument()
  })

  it('salva o texto "Sobre seu trabalho"', async () => {
    const account = newAccount(true)
    renderServicos(account)
    await userEvent.type(screen.getByLabelText('Sobre seu trabalho'), '  Atendo a região sul. ')
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1)!)

    expect(screen.getByText(/Alterações salvas nesta sessão/)).toBeInTheDocument()
    expect(getAccountProfessional(account)?.about).toBe('Atendo a região sul.')
  })
})

describe('Servicos: perfil publicado', () => {
  const carlos = () => getAccount('u1')!

  it('mostra o plano e pede o WhatsApp', () => {
    renderServicos(carlos())
    expect(screen.getByText(/Perfil publicado\. Plano mensal/)).toBeInTheDocument()
    expect(screen.getByText(/Cadastre seu WhatsApp no/)).toBeInTheDocument()
  })

  it('lista os contatos e marca como respondido', async () => {
    renderServicos(carlos())
    await userEvent.click(screen.getByRole('button', { name: /Contatos/ }))

    expect(screen.getByLabelText('2 novos')).toBeInTheDocument()
    expect(screen.getAllByText('Novo')).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Marcar como respondido' })[0])
    expect(screen.getAllByText('Novo')).toHaveLength(1)
  })

  it('mostra a nota e os comentários', async () => {
    renderServicos(carlos())
    await userEvent.click(screen.getByRole('button', { name: 'Avaliações' }))
    expect(screen.getByText('4,9', { selector: '.score-value' })).toBeInTheDocument()
    expect(screen.getByText('Fernanda')).toBeInTheDocument()
  })
})
