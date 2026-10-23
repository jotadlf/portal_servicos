import { describe, expect, it } from 'vitest'
import { formatCpf, isValidCpf } from './cpf'

describe('formatCpf', () => {
  it('aplica a máscara conforme a digitação', () => {
    expect(formatCpf('')).toBe('')
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('5299822')).toBe('529.982.2')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
  })

  it('ignora o que não é dígito e corta no 11º', () => {
    expect(formatCpf('529.982.247-25 99')).toBe('529.982.247-25')
  })
})

describe('isValidCpf', () => {
  it('aceita CPFs com dígitos verificadores certos', () => {
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('aceita dígito verificador zero', () => {
    // Resto 10 no cálculo vira 0
    expect(isValidCpf('12345678909')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(isValidCpf('52998224724')).toBe(false)
    expect(isValidCpf('52998224715')).toBe(false)
  })

  it('recusa todos os dígitos iguais, tamanho errado e máscara', () => {
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
    expect(isValidCpf('529.982.247-25')).toBe(false)
  })
})
