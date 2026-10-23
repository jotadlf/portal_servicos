import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Rating } from './Rating'

describe('Rating', () => {
  it('mostra a nota e a quantidade de avaliações', () => {
    render(<Rating rating={4.9} reviews={132} />)
    expect(screen.getByText('4,9')).toBeInTheDocument()
    expect(screen.getByText(/132 avaliações/)).toBeInTheDocument()
  })

  it('usa o singular com uma avaliação', () => {
    render(<Rating rating={5} reviews={1} />)
    expect(screen.getByText(/1 avaliação\)/)).toBeInTheDocument()
  })

  it('avisa quando o prestador ainda não tem avaliações', () => {
    render(<Rating rating={0} reviews={0} />)
    expect(screen.getByText('Novo no portal, sem avaliações')).toBeInTheDocument()
  })
})
