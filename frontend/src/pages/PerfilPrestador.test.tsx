import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { dbExec, dbRow, dbRows, loginAs, newAccount, SAMPLE_IDS } from '../test/supabase'
import { PerfilPrestador } from './PerfilPrestador'

// Beatriz já tocou em "Falar no WhatsApp" do Carlos
const contactedByBeatriz = () =>
  dbExec(
    `insert into public.contatos (prestador_id, cliente_id, cliente, servico, bairro, data)
     values ('p1', $1, 'Beatriz Rocha', 'Instalar chuveiro', 'Setor Marista', current_date)`,
    SAMPLE_IDS.beatriz,
  )

async function renderPerfil(props: Partial<Parameters<typeof PerfilPrestador>[0]> = {}) {
  const onLogin = vi.fn()
  render(<PerfilPrestador id="p1" isLoggedIn={false} onLogin={onLogin} {...props} />)
  await screen.findByRole('heading', { level: 2, name: 'Serviços' }).catch(() => undefined)
  return { onLogin }
}

describe('PerfilPrestador', () => {
  it('avisa quando o prestador não existe', async () => {
    render(<PerfilPrestador id="p999" isLoggedIn={false} onLogin={vi.fn()} />)
    expect(await screen.findByText('Não encontramos este prestador.')).toBeInTheDocument()
  })

  it('sem login mostra só o primeiro nome e esconde os preços', async () => {
    const { onLogin } = await renderPerfil()
    expect(screen.getByRole('heading', { level: 1, name: 'Carlos' })).toBeInTheDocument()
    expect(screen.getAllByText('preço visível após entrar')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('com login mostra nome completo, preços e avaliações do banco', async () => {
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Carlos Henrique' })).toBeInTheDocument()
    expect(screen.getByText(/R\$\s150/)).toBeInTheDocument()
    expect(screen.getByText('Fernanda')).toBeInTheDocument()
    expect(screen.queryByText('preço visível após entrar')).not.toBeInTheDocument()
  })

  it('mostra o texto "Sobre" com HTML como texto, sem executar', async () => {
    await dbExec(`update public.prestadores set sobre = '<img src=x onerror=alert(1)>' where id = 'p1'`)
    await renderPerfil()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('abre o WhatsApp quando o prestador tem número', async () => {
    await dbExec(`update public.prestadores set whatsapp = '62999998888' where id = 'p1'`)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })

    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abrir conversa' }))
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/5562999998888\?text=/),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('avisa quando o prestador não tem WhatsApp', async () => {
    await dbExec(`update public.prestadores set whatsapp = '' where id = 'p1'`)
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(screen.getByText('Carlos ainda não cadastrou o WhatsApp.')).toBeInTheDocument()
  })

  it('o toque no WhatsApp grava o contato e libera a avaliação', async () => {
    await dbExec(`update public.prestadores set whatsapp = '62999998888' where id = 'p1'`)
    vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })
    expect(await screen.findByText(/Depois de falar com Carlos pelo WhatsApp/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abrir conversa' }))
    expect(await screen.findByRole('group', { name: 'Como foi o serviço com Carlos?' })).toBeInTheDocument()
    const saved = await dbRows(
      `select cliente, servico, bairro from public.contatos where prestador_id = 'p1' and cliente_id = $1`,
      SAMPLE_IDS.beatriz,
    )
    expect(saved).toEqual([{ cliente: 'Beatriz Rocha', servico: '', bairro: 'Setor Marista' }])
  })

  it('avaliar grava a nota, mostra o comentário e atualiza a média', async () => {
    await contactedByBeatriz()
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })

    await userEvent.click(await screen.findByRole('button', { name: 'Enviar avaliação' }))
    expect(screen.getByText('Escolha de 1 a 5 estrelas.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: '4 estrelas' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Comentário (opcional)' }), 'Chegou cedo e resolveu.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(await screen.findByText('Avaliação enviada. Obrigado!')).toBeInTheDocument()
    expect(screen.getByText('Chegou cedo e resolveu.', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/133 avaliações/)).toBeInTheDocument()
    const review = await dbRow(`select autor, nota from public.avaliacoes where cliente_id = $1`, SAMPLE_IDS.beatriz)
    expect(review).toEqual({ autor: 'Beatriz', nota: 4 })
    expect(screen.getByRole('button', { name: 'Atualizar avaliação' })).toBeInTheDocument()
  })

  it('quem já avaliou vê a própria avaliação para refazer', async () => {
    await contactedByBeatriz()
    await dbExec(
      `insert into public.avaliacoes (prestador_id, cliente_id, autor, nota, comentario, data)
       values ('p1', $1, 'Beatriz', 3, 'Demorou um pouco.', current_date)`,
      SAMPLE_IDS.beatriz,
    )
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })
    expect(await screen.findByRole('group', { name: 'Sua avaliação' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3 estrelas' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Comentário (opcional)' })).toHaveValue('Demorou um pouco.')
  })

  it('o próprio prestador não vê o convite para avaliar', async () => {
    await loginAs('carlos@exemplo.com')
    await renderPerfil({ isLoggedIn: true })
    await screen.findByText('Fernanda')
    await vi.waitFor(() => expect(document.querySelector('.review-form')).toBeNull())
    expect(screen.queryByText(/Depois de falar com/)).not.toBeInTheDocument()
  })

  it('rascunho só aparece para o próprio prestador', async () => {
    const account = await newAccount({ asProvider: true })
    const { unmount } = render(<PerfilPrestador id={account.professionalId!} isLoggedIn onLogin={vi.fn()} />)
    expect(await screen.findByText(/Rascunho: só você vê este perfil/)).toBeInTheDocument()
    unmount()

    sessionStorage.clear()
    await loginAs('beatriz@exemplo.com')
    render(<PerfilPrestador id={account.professionalId!} isLoggedIn onLogin={vi.fn()} />)
    expect(await screen.findByText('Não encontramos este prestador.')).toBeInTheDocument()
  })
})
