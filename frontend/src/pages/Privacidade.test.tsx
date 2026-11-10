import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTROLLER } from '../lib/controlador'
import { Privacidade } from './Privacidade'

describe('Privacidade', () => {
  it('mostra o controlador, o canal de contato e as seções da LGPD', () => {
    render(<Privacidade />)
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeInTheDocument()
    for (const heading of [
      'Quem cuida dos seus dados',
      'Quais dados guardamos e por quê',
      'Empresas que tratam dados para nós',
      'Dados guardados fora do Brasil',
      'Por quanto tempo guardamos',
      'Seus direitos',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(new RegExp(CONTROLLER.name))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: CONTROLLER.email })).toHaveAttribute('href', `mailto:${CONTROLLER.email}`)
    expect(screen.getAllByRole('link', { name: /página de contato/ })[0]).toHaveAttribute('href', '#/contato')
    expect(screen.getByRole('region', { name: 'Dados guardados fora do Brasil' })).toHaveTextContent('Estados Unidos')
  })

  it('não ficou dado do controlador por preencher', () => {
    expect(Object.values(CONTROLLER).join(' ')).not.toMatch(/PREENCHER/)
  })
})
