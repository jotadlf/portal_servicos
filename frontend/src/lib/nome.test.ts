import { describe, expect, it } from 'vitest'
import { isValidName } from './nome'

describe('isValidName', () => {
  it('aceita nomes com acento, apóstrofo e hífen', () => {
    expect(isValidName('Ana Lima')).toBe(true)
    expect(isValidName('José Conceição')).toBe(true)
    expect(isValidName("Joana D'Ávila")).toBe(true)
    expect(isValidName('Joana D’Ávila')).toBe(true)
    expect(isValidName('Maria-José')).toBe(true)
    expect(isValidName('  Ana   Lima  ')).toBe(true)
  })

  it('aceita acento digitado como letra + sinal separado', () => {
    expect(isValidName('José')).toBe(true)
  })

  it('recusa números e símbolos', () => {
    expect(isValidName('Ana 2')).toBe(false)
    expect(isValidName('Ana123')).toBe(false)
    expect(isValidName('123')).toBe(false)
    expect(isValidName('Ana@Lima')).toBe(false)
    expect(isValidName('Ana Lima.')).toBe(false)
  })

  it('recusa vazio e separador solto', () => {
    expect(isValidName('')).toBe(false)
    expect(isValidName('   ')).toBe(false)
    expect(isValidName('-Ana')).toBe(false)
    expect(isValidName("Ana '")).toBe(false)
  })
})
