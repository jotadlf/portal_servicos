import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTROLLER } from '../lib/controlador'
import { Privacidade } from './Privacidade'

describe('Privacidade', () => {
  it('mostra o controlador, o canal de contato e as seções principais', () => {
    render(<Privacidade />)
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeInTheDocument()
    for (const heading of [
      'Quem cuida dos seus dados',
      'O que guardamos e para quê',
      'Quem vê o quê',
      'Empresas que nos ajudam',
      'Por quanto tempo',
      'Seus direitos',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'Quem cuida dos seus dados' })).toHaveTextContent(CONTROLLER.name)
    expect(screen.getByRole('link', { name: CONTROLLER.email })).toHaveAttribute('href', `mailto:${CONTROLLER.email}`)
    expect(screen.getAllByRole('link', { name: /página de contato/ })[0]).toHaveAttribute('href', '#/contato')
    expect(screen.getByRole('region', { name: 'Empresas que nos ajudam' })).toHaveTextContent('Estados Unidos')
  })

  it('não cita leis nem artigos', () => {
    render(<Privacidade />)
    expect(document.body.textContent).not.toMatch(/\bart\.|\bLei\b|LGPD|Código/)
  })

  it('não ficou dado do controlador por preencher', () => {
    expect(Object.values(CONTROLLER).join(' ')).not.toMatch(/PREENCHER/)
  })
})
