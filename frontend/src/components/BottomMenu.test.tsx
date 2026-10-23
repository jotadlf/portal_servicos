import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomMenu } from './BottomMenu'

describe('BottomMenu', () => {
  it('leva para as páginas principais e marca a atual', () => {
    render(<BottomMenu current="servicos" />)
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '#/')
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '#/conta')
    expect(screen.getByRole('link', { name: 'Serviços' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('só mostra a administração para quem administra', () => {
    const { rerender } = render(<BottomMenu current="inicio" />)
    expect(screen.queryByRole('link', { name: 'Administração' })).not.toBeInTheDocument()

    rerender(<BottomMenu current="inicio" showAdmin />)
    expect(screen.getByRole('link', { name: 'Administração' })).toHaveAttribute('href', '#/admin')
  })

  it('avisa a página inicial ao tocar em Início', async () => {
    const onInicio = vi.fn()
    render(<BottomMenu current="inicio" onInicio={onInicio} />)
    await userEvent.click(screen.getByRole('link', { name: 'Início' }))
    expect(onInicio).toHaveBeenCalled()
  })
})
