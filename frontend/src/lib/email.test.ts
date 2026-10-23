import { describe, expect, it } from 'vitest'
import { isValidEmail } from './email'

describe('isValidEmail', () => {
  it('aceita e-mails comuns', () => {
    expect(isValidEmail('ana@exemplo.com')).toBe(true)
    expect(isValidEmail('ana.lima+portal@mail.exemplo.com.br')).toBe(true)
    expect(isValidEmail('  ana@exemplo.com ')).toBe(true)
  })

  it('recusa e-mails incompletos ou malformados', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('ana')).toBe(false)
    expect(isValidEmail('ana@')).toBe(false)
    expect(isValidEmail('@exemplo.com')).toBe(false)
    expect(isValidEmail('ana@exemplo')).toBe(false)
    expect(isValidEmail('ana@exemplo.c')).toBe(false)
    expect(isValidEmail('ana@.com')).toBe(false)
    expect(isValidEmail('ana@exemplo..com')).toBe(false)
    expect(isValidEmail('ana lima@exemplo.com')).toBe(false)
    expect(isValidEmail('ana@@exemplo.com')).toBe(false)
  })

  it('recusa e-mail longo demais', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@exemplo.com`)).toBe(false)
  })
})
