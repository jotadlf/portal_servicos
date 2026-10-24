import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { dbExec, loginAs, newAccount } from '../test/supabase'
import { PerfilPrestador } from './PerfilPrestador'

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
    await dbExec(`update public.professionals set about = '<img src=x onerror=alert(1)>' where id = 'p1'`)
    await renderPerfil()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('abre o WhatsApp quando o prestador tem número', async () => {
    await dbExec(`update public.professionals set whatsapp = '62999998888' where id = 'p1'`)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })

    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/5562999998888\?text=/),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('avisa quando o prestador não tem WhatsApp', async () => {
    await dbExec(`update public.professionals set whatsapp = '' where id = 'p1'`)
    await loginAs('beatriz@exemplo.com')
    await renderPerfil({ isLoggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(screen.getByText('Carlos ainda não cadastrou o WhatsApp.')).toBeInTheDocument()
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
