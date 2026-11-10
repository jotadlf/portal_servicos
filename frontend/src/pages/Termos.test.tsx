import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTROLLER, TERMS_UPDATED_AT } from '../lib/controlador'
import { Termos } from './Termos'

describe('Termos', () => {
  it('mostra quem mantém o portal, a versão e as seções principais', () => {
    render(<Termos />)
    expect(screen.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeInTheDocument()
    expect(screen.getByText(`Atualizados em ${TERMS_UPDATED_AT}.`)).toBeInTheDocument()
    for (const heading of [
      'Quem somos',
      'O que o portal faz',
      'Plano e cancelamento',
      'Não é permitido',
      'Disputas',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'Quem somos' })).toHaveTextContent(CONTROLLER.name)
    expect(screen.getByRole('link', { name: CONTROLLER.email })).toHaveAttribute('href', `mailto:${CONTROLLER.email}`)
    expect(screen.getByRole('region', { name: 'Plano e cancelamento' })).toHaveTextContent('7 dias')
    expect(screen.getByRole('link', { name: 'política de privacidade' })).toHaveAttribute('href', '#/privacidade')
  })

  it('não cita leis nem artigos', () => {
    render(<Termos />)
    expect(document.body.textContent).not.toMatch(/\bart\.|\bLei\b|LGPD|Código/)
  })
})
