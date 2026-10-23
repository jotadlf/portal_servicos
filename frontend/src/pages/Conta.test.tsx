import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { currentAccount, type Account } from '../features/conta/usuario'
import { dbRow, loginAs, newAccount, PNG_FILE } from '../test/api-server'
import { Conta } from './Conta'

function renderConta(account?: Account) {
  const handlers = { onLogin: vi.fn(), onLogout: vi.fn(), onAccountChange: vi.fn() }
  render(<Conta account={account} {...handlers} />)
  return handlers
}

// Só o ViaCEP é simulado; a API continua sendo a real
function mockViaCep(data: object) {
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes('viacep.com.br')
      ? Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))
      : realFetch(input, init),
  )
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))
const saved = () => screen.findByText('Perfil salvo.')
const photoInput = () => screen.getByLabelText('Foto do perfil')
const accountRow = (id: string) => dbRow('SELECT * FROM accounts WHERE id = ?', id)!

describe('Conta: gravação real', () => {
  it('sem login pede para entrar', async () => {
    const { onLogin } = renderConta()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('grava nome, telefone e endereço no banco, normalizados', async () => {
    const account = await newAccount()
    const { onAccountChange } = renderConta(account)

    await userEvent.clear(screen.getByLabelText(/^Nome/))
    await userEvent.type(screen.getByLabelText(/^Nome/), '  Ana   Souza ')
    await userEvent.type(screen.getByLabelText(/^WhatsApp/), '62999998888')
    await userEvent.type(screen.getByLabelText(/^Rua/), ' Rua T-30 ')
    await userEvent.type(screen.getByLabelText(/^Número/), 'Qd 5 Lt 10')
    await userEvent.type(screen.getByLabelText(/^Complemento/), 'Apto 302')
    await userEvent.type(screen.getByLabelText(/^Bairro/), 'Setor Oeste')
    await userEvent.type(screen.getByLabelText(/^Cidade/), 'Pau-d’Arco')
    await userEvent.type(screen.getByLabelText(/^UF/), 'go')
    await save()

    expect(await saved()).toBeInTheDocument()
    expect(accountRow(account.id)).toMatchObject({
      name: 'Ana Souza',
      phone: '62999998888',
      street: 'Rua T-30',
      number: 'Qd 5 Lt 10',
      complement: 'Apto 302',
      neighborhood: 'Setor Oeste',
      city: 'Pau-d’Arco',
      state: 'GO',
    })
    expect(onAccountChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Souza' }))

    // Mexer no formulário de novo apaga o aviso de salvo
    await userEvent.type(screen.getByLabelText(/^Bairro/), 'x')
    expect(screen.queryByText('Perfil salvo.')).not.toBeInTheDocument()
  })

  it('o que foi salvo continua lá ao abrir o perfil de novo', async () => {
    const account = await newAccount()
    renderConta(account)
    await userEvent.type(screen.getByLabelText(/^Bairro/), 'Setor Sul')
    await save()
    await saved()
    const reloaded = (await currentAccount())!
    renderConta(reloaded)
    expect(screen.getAllByLabelText(/^Bairro/).at(-1)).toHaveValue('Setor Sul')
  })

  it('formata o WhatsApp e não grava número incompleto', async () => {
    const account = await newAccount()
    renderConta(account)
    const phone = screen.getByLabelText(/^WhatsApp/)
    await userEvent.type(phone, '6299999')
    expect(phone).toHaveValue('(62) 9999-9')

    await save()
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(phone).toHaveAccessibleDescription(/Informe o WhatsApp com DDD/)
    expect(accountRow(account.id).phone).toBe('')
  })

  it.each([
    ['nome com números', /^Nome/, 'Ana 2', 'Use só letras no nome, sem números ou símbolos.'],
    ['cidade com números', /^Cidade/, 'Goiânia 2', 'Use só letras no nome da cidade.'],
    ['CEP incompleto', /^CEP/, '74215', 'Complete os 8 números do CEP.'],
  ])('não grava %s', async (_, label, value, message) => {
    const account = await newAccount()
    renderConta(account)
    const field = screen.getByLabelText(label)
    await userEvent.clear(field)
    await userEvent.type(field, value)
    await save()

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(message)
    expect(field).toHaveFocus()
    expect(accountRow(account.id).name).toBe('Ana Lima')
  })

  // Achado da exploração: o campo cortava em 10 caracteres sem avisar
  it('aceita número de endereço no formato quadra/lote', async () => {
    const account = await newAccount()
    renderConta(account)
    await userEvent.type(screen.getByLabelText(/^Número/), 'Qd 12 Lt 34 Casa 2')
    await save()
    await saved()
    expect(accountRow(account.id).number).toBe('Qd 12 Lt 34 Casa 2')
  })

  it('WhatsApp colado com +55 é gravado sem o código do país', async () => {
    const account = await newAccount()
    renderConta(account)
    await userEvent.click(screen.getByLabelText(/^WhatsApp/))
    await userEvent.paste('+55 (62) 99999-8888')
    await save()
    await saved()
    expect(accountRow(account.id).phone).toBe('62999998888')
  })

  it('UF aceita só letras e recusa sigla que não existe', async () => {
    renderConta(await newAccount())
    const uf = screen.getByLabelText(/^UF/)
    await userEvent.type(uf, '1x9y')
    expect(uf).toHaveValue('XY')
    await save()
    expect(uf).toHaveAccessibleDescription('UF inválida.')
  })

  it('mostra o link da administração só para admin', async () => {
    renderConta(await loginAs('admin@exemplo.com'))
    expect(screen.getByRole('link', { name: 'Abrir administração do portal' })).toHaveAttribute('href', '#/admin')
  })

  it('sai da conta', async () => {
    const { onLogout } = renderConta(await newAccount())
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalled()
  })
})

describe('Conta: foto', () => {
  it('quem só contrata salva sem foto', async () => {
    renderConta(await newAccount())
    expect(screen.getByRole('button', { name: 'Adicionar foto' })).toHaveAccessibleDescription('Opcional.')
    await save()
    expect(await saved()).toBeInTheDocument()
  })

  it('exige foto de quem oferece serviços e grava a imagem no banco', async () => {
    const account = await newAccount({ asProvider: true })
    renderConta(account)
    const button = screen.getByRole('button', { name: 'Adicionar foto' })
    await save()
    expect(button).toHaveAccessibleDescription('Adicione uma foto: ela aparece no seu perfil de prestador.')
    expect(button).toHaveFocus()

    await userEvent.upload(photoInput(), PNG_FILE())
    expect(await screen.findByRole('button', { name: 'Trocar foto' })).toBeInTheDocument()
    const photoId = accountRow(account.id).photo_id as string
    expect(dbRow('SELECT mime FROM photos WHERE id = ?', photoId)?.mime).toBe('image/png')
    // A foto vai junto para o perfil público
    expect(dbRow('SELECT photo_id FROM professionals WHERE account_id = ?', account.id)?.photo_id).toBe(photoId)

    await save()
    expect(await saved()).toBeInTheDocument()
  })

  it('recusa SVG antes de enviar', async () => {
    renderConta(await newAccount())
    await userEvent.upload(photoInput(), new File(['<svg/>'], 'icone.svg', { type: 'image/svg+xml' }), {
      applyAccept: false,
    })
    expect(screen.getByRole('button', { name: 'Adicionar foto' })).toHaveAccessibleDescription(
      'Escolha um arquivo de imagem, como JPG ou PNG.',
    )
    expect(dbRow(`SELECT count(*) AS n FROM photos WHERE id NOT LIKE 'exemplo-%'`)?.n).toBe(0)
  })

  it('o servidor recusa arquivo disfarçado de imagem', async () => {
    renderConta(await newAccount())
    await userEvent.upload(photoInput(), new File(['%PDF-1.4'], 'foto.png', { type: 'image/png' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Adicionar foto' })).toHaveAccessibleDescription(
        'Escolha um arquivo de imagem, como JPG ou PNG.',
      ),
    )
    expect(dbRow(`SELECT count(*) AS n FROM photos WHERE id NOT LIKE 'exemplo-%'`)?.n).toBe(0)
  })

  it('recusa foto maior que 5 MB', async () => {
    renderConta(await newAccount())
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' })
    await userEvent.upload(photoInput(), big)
    expect(screen.getByRole('button', { name: 'Adicionar foto' })).toHaveAccessibleDescription(
      'A foto precisa ter até 5 MB.',
    )
  })
})

describe('Conta: CEP', () => {
  it('preenche o endereço pelo CEP e põe o foco no número', async () => {
    mockViaCep({ logradouro: 'Rua T-30', bairro: 'Setor Bueno', localidade: 'Goiânia', uf: 'GO' })
    renderConta(await newAccount())
    await userEvent.type(screen.getByLabelText(/^CEP/), '74215010')
    expect(await screen.findByDisplayValue('Rua T-30')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Cidade/)).toHaveValue('Goiânia')
    expect(screen.getByLabelText(/^Número/)).toHaveFocus()
  })

  it('avisa quando o CEP não existe', async () => {
    mockViaCep({ erro: true })
    renderConta(await newAccount())
    await userEvent.type(screen.getByLabelText(/^CEP/), '00000000')
    expect(await screen.findByText(/Não encontramos esse CEP/)).toBeInTheDocument()
  })
})
