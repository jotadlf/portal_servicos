import { describe, expect, it } from 'vitest'
import {
  firstName,
  formatDate,
  formatPrice,
  formatRating,
  greeting,
  initials,
  normalize,
} from './format'

// toLocaleString usa espaço não separável entre "R$" e o valor
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('normalize', () => {
  it('ignora maiúsculas e acentos', () => {
    expect(normalize('Elétrica')).toBe('eletrica')
    expect(normalize('MANUTENÇÃO')).toBe('manutencao')
  })
})

describe('formatRating', () => {
  it('mostra sempre uma casa decimal com vírgula', () => {
    expect(formatRating(5)).toBe('5,0')
    expect(formatRating(4.86)).toBe('4,9')
  })
})

describe('formatPrice', () => {
  it('formata em reais sem centavos', () => {
    expect(plain(formatPrice(150))).toBe('R$ 150')
    expect(plain(formatPrice(1250))).toBe('R$ 1.250')
  })
})

describe('formatDate', () => {
  it('mostra dia e mês abreviado sem mudar o dia pelo fuso', () => {
    expect(formatDate('2026-03-01')).toMatch(/^1 de mar/)
    expect(formatDate('2026-12-31')).toMatch(/^31 de dez/)
  })
})

describe('greeting', () => {
  const at = (hour: number) => new Date(2026, 0, 1, hour)

  it('cumprimenta conforme a hora', () => {
    expect(greeting(at(5))).toBe('Bom dia')
    expect(greeting(at(11))).toBe('Bom dia')
    expect(greeting(at(12))).toBe('Boa tarde')
    expect(greeting(at(17))).toBe('Boa tarde')
    expect(greeting(at(18))).toBe('Boa noite')
    expect(greeting(at(2))).toBe('Boa noite')
  })
})

describe('nomes', () => {
  it('pega o primeiro nome', () => {
    expect(firstName('Carlos Henrique Souza')).toBe('Carlos')
    expect(firstName('Beatriz')).toBe('Beatriz')
  })

  it('pega as iniciais dos dois primeiros nomes', () => {
    expect(initials('Carlos Henrique Souza')).toBe('CH')
    expect(initials('Beatriz')).toBe('B')
  })
})
