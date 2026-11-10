import { describe, expect, it } from 'vitest'
import { birthDateError, formatBirthDate, toIsoDate } from './nascimento'

describe('formatBirthDate', () => {
  it('aplica a máscara conforme a digitação', () => {
    expect(formatBirthDate('')).toBe('')
    expect(formatBirthDate('25')).toBe('25')
    expect(formatBirthDate('250')).toBe('25/0')
    expect(formatBirthDate('25031')).toBe('25/03/1')
    expect(formatBirthDate('25031990')).toBe('25/03/1990')
  })

  it('ignora o que não é dígito e corta no 8º', () => {
    expect(formatBirthDate('25/03/1990 12')).toBe('25/03/1990')
  })
})

describe('toIsoDate', () => {
  it('converte DD/MM/AAAA de uma data que existe', () => {
    expect(toIsoDate('25/03/1990')).toBe('1990-03-25')
    expect(toIsoDate('29/02/2000')).toBe('2000-02-29')
  })

  it('recusa data incompleta ou que não existe', () => {
    expect(toIsoDate('25/03/199')).toBeNull()
    expect(toIsoDate('31/02/1990')).toBeNull()
    expect(toIsoDate('29/02/1999')).toBeNull()
    expect(toIsoDate('01/13/1990')).toBeNull()
    expect(toIsoDate('00/01/1990')).toBeNull()
  })
})

describe('birthDateError', () => {
  const today = new Date(2026, 10, 10)

  it('pede a data quando vazia', () => {
    expect(birthDateError('', today)).toBe('Informe sua data de nascimento.')
  })

  it('recusa data inválida, no futuro ou de mais de 120 anos', () => {
    const invalid = 'Informe uma data válida, como 25/03/1990.'
    expect(birthDateError('31/02/1990', today)).toBe(invalid)
    expect(birthDateError('11/11/2026', today)).toBe(invalid)
    expect(birthDateError('10/11/1906', today)).toBe(invalid)
  })

  it('exige 18 anos completos', () => {
    expect(birthDateError('11/11/2008', today)).toBe('É preciso ter 18 anos ou mais para oferecer serviços.')
    expect(birthDateError('10/11/2008', today)).toBeUndefined()
    expect(birthDateError('11/11/1906', today)).toBeUndefined()
  })

  // Mesma conta do banco (data - interval '18 years')
  it('quem nasceu em 29/02 faz 18 anos em 01/03 de ano não bissexto', () => {
    expect(birthDateError('29/02/2008', new Date(2026, 1, 28))).toMatch(/18 anos/)
    expect(birthDateError('29/02/2008', new Date(2026, 2, 1))).toBeUndefined()
  })

  it('em 29/02, faz 18 anos quem nasceu até 28/02 de 18 anos antes', () => {
    expect(birthDateError('28/02/2010', new Date(2028, 1, 29))).toBeUndefined()
    expect(birthDateError('01/03/2010', new Date(2028, 1, 29))).toMatch(/18 anos/)
  })
})
