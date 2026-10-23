import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProfessional, updateProfessional } from '../features/profissionais/dados-exemplo'
import { PerfilPrestador } from './PerfilPrestador'

const original = { ...getProfessional('p1')! }
// Object.assign não apaga campos: o WhatsApp de um teste precisa sair explicitamente
afterEach(() => updateProfessional('p1', { ...original, whatsapp: undefined }))

function renderPerfil(props: Partial<Parameters<typeof PerfilPrestador>[0]> = {}) {
  const onLogin = vi.fn()
  render(<PerfilPrestador id="p1" isLoggedIn={false} isOwner={false} onLogin={onLogin} {...props} />)
  return { onLogin }
}

describe('PerfilPrestador', () => {
  it('avisa quando o prestador não existe', () => {
    renderPerfil({ id: 'p999' })
    expect(screen.getByText('Não encontramos este prestador.')).toBeInTheDocument()
  })

  it('sem login mostra só o primeiro nome e esconde os preços', async () => {
    const { onLogin } = renderPerfil()
    expect(screen.getByRole('heading', { level: 1, name: 'Carlos' })).toBeInTheDocument()
    expect(screen.getAllByText('preço visível após entrar')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalled()
  })

  it('com login mostra nome completo, preços e avaliações', () => {
    renderPerfil({ isLoggedIn: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Carlos Henrique' })).toBeInTheDocument()
    expect(screen.getByText(/R\$\s150/)).toBeInTheDocument()
    expect(screen.getByText('Fernanda')).toBeInTheDocument()
    expect(screen.queryByText('preço visível após entrar')).not.toBeInTheDocument()
  })

  it('abre o WhatsApp quando o prestador tem número', async () => {
    updateProfessional('p1', { whatsapp: '62999998888' })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPerfil({ isLoggedIn: true })

    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/5562999998888\?text=/),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('avisa quando o prestador não tem WhatsApp', async () => {
    renderPerfil({ isLoggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Falar com Carlos no WhatsApp' }))
    expect(screen.getByText('Carlos ainda não cadastrou o WhatsApp.')).toBeInTheDocument()
  })

  it('rascunho só aparece para o próprio prestador', () => {
    updateProfessional('p1', { status: 'rascunho' })
    const { unmount } = render(
      <PerfilPrestador id="p1" isLoggedIn isOwner={false} onLogin={vi.fn()} />,
    )
    expect(screen.getByText('Não encontramos este prestador.')).toBeInTheDocument()
    unmount()

    renderPerfil({ isLoggedIn: true, isOwner: true })
    expect(screen.getByText(/Rascunho: só você vê este perfil/)).toBeInTheDocument()
  })
})
