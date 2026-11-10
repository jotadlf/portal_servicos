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
      'O que o portal faz e o que não faz',
      'Plano, período grátis e cancelamento',
      'O que não é permitido',
      'Denúncias e remoção de conteúdo',
      'Lei e foro',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'Quem somos' })).toHaveTextContent(CONTROLLER.name)
    expect(screen.getAllByRole('link', { name: CONTROLLER.email })[0]).toHaveAttribute('href', `mailto:${CONTROLLER.email}`)
    expect(screen.getByRole('region', { name: 'Plano, período grátis e cancelamento' })).toHaveTextContent('7 dias')
    expect(screen.getByRole('link', { name: 'política de privacidade' })).toHaveAttribute('href', '#/privacidade')
  })
})
