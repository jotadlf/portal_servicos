import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Account } from '../features/conta/usuario'
import { dbExec, dbRow, dbRows, loginAs, newAccount, readyProvider } from '../test/supabase'
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
  dbRows('select modalidade_id, nome, preco from public.servicos where prestador_id = $1 order by posicao', professionalId)

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
    expect((await dbRow('select status from public.prestadores where conta_id = $1', account.id))?.status).toBe('rascunho')
  })

  it('administração não vê oferta de plano nem preço', async () => {
    renderServicos({ ...(await newAccount()), isAdmin: true })
    expect(screen.getByText(/Como administrador, você usa tudo sem plano/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quero oferecer serviços' })).toBeInTheDocument()
    // Dá tempo de a oferta carregar, se fosse aparecer
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(screen.queryByText(/dias grátis|por mês/)).not.toBeInTheDocument()
  })
})

describe('Servicos: meus serviços gravados no banco', () => {
  it('adiciona, edita, apaga e desfaz, sempre conferindo o banco', async () => {
    const account = await newAccount({ asProvider: true })
    renderServicos(account)
    await painel()

    await addService('Instalar ventilador', '120')
    expect(screen.getByText(/média R\$\s120/)).toBeInTheDocument()
    expect(await servicesOf(account.professionalId!)).toEqual([
      { modalidade_id: 'eletricista', nome: 'Instalar ventilador', preco: 120 },
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Editar Instalar ventilador' }))
    await userEvent.clear(screen.getByLabelText(/^Preço médio/))
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('a combinar')).toBeInTheDocument()
    expect((await servicesOf(account.professionalId!))[0].preco).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Apagar Instalar ventilador' }))
    expect(await screen.findByText(/Instalar ventilador apagado/)).toBeInTheDocument()
    expect(await servicesOf(account.professionalId!)).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('button', { name: 'Editar Instalar ventilador' })).toBeInTheDocument()
    expect(await servicesOf(account.professionalId!)).toHaveLength(1)
  })

  it('escolhe como o preço é cobrado (padrão: por serviço)', async () => {
    const account = await newAccount({ asProvider: true })
    renderServicos(account)
    await painel()
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))

    const folha = within(screen.getByRole('dialog', { name: 'Novo serviço' }))
    expect(folha.getByRole('radio', { name: 'Por serviço' })).toBeChecked()
    await userEvent.type(folha.getByLabelText('Serviço'), 'Pintar parede')
    await userEvent.type(folha.getByLabelText(/^Preço médio/), '25')
    await userEvent.click(folha.getByRole('radio', { name: 'Por m²' }))
    await userEvent.click(folha.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/média R\$\s25 por m²/)).toBeInTheDocument()
    expect((await dbRow('select unidade from public.servicos where prestador_id = $1', account.professionalId!))?.unidade).toBe('m2')
  })

  it('adicionar abre a folha "Novo serviço"; o X fecha e reabre limpa', async () => {
    renderServicos(await newAccount({ asProvider: true }))
    await painel()
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))

    const folha = screen.getByRole('dialog', { name: 'Novo serviço' })
    expect(folha).toHaveAttribute('open')
    expect(within(folha).getByLabelText('Serviço')).toHaveFocus()
    await userEvent.type(within(folha).getByLabelText('Serviço'), 'Rascunho')

    await userEvent.click(within(folha).getByRole('button', { name: 'Fechar' }))
    expect(folha).not.toHaveAttribute('open')
    expect(screen.queryByLabelText('Serviço')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
    expect(screen.getByLabelText('Serviço')).toHaveValue('')
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
    await dbExec(`delete from public.modalidades where id = 'pintor'`)

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }))
    await userEvent.selectOptions(screen.getByLabelText('Profissão'), 'pintor')
    await userEvent.type(screen.getByLabelText('Serviço'), 'Pintar muro')
    await userEvent.click(editor().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Escolha uma profissão do catálogo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Serviço')).toHaveValue('Pintar muro')
    expect(await servicesOf(account.professionalId!)).toHaveLength(0)
  })

  it('grava o texto "Sobre seu trabalho"', async () => {
    const account = await newAccount({ asProvider: true })
    renderServicos(account)
    await painel()
    await userEvent.type(screen.getByLabelText('Sobre seu trabalho'), '  Atendo a região sul. ')
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1)!)
    expect(await screen.findByText('Texto salvo.')).toBeInTheDocument()
    expect((await dbRow('select sobre from public.prestadores where conta_id = $1', account.id))?.sobre).toBe('Atendo a região sul.')
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
    await dbExec(`update public.prestadores set whatsapp = '' where id = 'p1'`)
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
    expect((await dbRow(`select count(*) as n from public.contatos where respondido = false`))?.n).toBe(1)
  })

  it('mostra a nota e os comentários', async () => {
    renderServicos(await loginAs('carlos@exemplo.com'))
    await painel()
    await userEvent.click(screen.getByRole('button', { name: 'Avaliações' }))
    expect(screen.getByText('4,9', { selector: '.score-value' })).toBeInTheDocument()
    expect(screen.getByText('Fernanda')).toBeInTheDocument()
  })
})
