import { afterEach, describe, expect, it, vi } from 'vitest'
import { contactMessage, formatPhone, isValidPhone, openWhatsapp } from './whatsapp'

describe('isValidPhone', () => {
  it('aceita DDD + 8 ou 9 dígitos', () => {
    expect(isValidPhone('6233334444')).toBe(true)
    expect(isValidPhone('62999998888')).toBe(true)
  })

  it('recusa DDD começando com zero, tamanho errado ou máscara', () => {
    expect(isValidPhone('0299998888')).toBe(false)
    expect(isValidPhone('623333444')).toBe(false)
    expect(isValidPhone('629999988881')).toBe(false)
    expect(isValidPhone('(62) 99999-8888')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('aplica a máscara conforme a digitação', () => {
    expect(formatPhone('')).toBe('')
    expect(formatPhone('6')).toBe('(6')
    expect(formatPhone('62')).toBe('(62')
    expect(formatPhone('629')).toBe('(62) 9')
    expect(formatPhone('6233334444')).toBe('(62) 3333-4444')
    expect(formatPhone('62999998888')).toBe('(62) 99999-8888')
  })

  it('ignora o que não é dígito e corta no 11º', () => {
    expect(formatPhone('(62) 99999-8888 ramal 2')).toBe('(62) 99999-8888')
  })
})

describe('contactMessage', () => {
  it('cita o serviço quando informado', () => {
    expect(contactMessage('Carlos')).toBe(
      'Olá, Carlos! Vi seu perfil no Portal de Serviços e gostaria de conversar.',
    )
    expect(contactMessage('Carlos', 'Instalar chuveiro')).toBe(
      'Olá, Carlos! Vi seu perfil no Portal de Serviços e gostaria de conversar sobre o serviço "Instalar chuveiro".',
    )
  })
})

describe('openWhatsapp', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('abre o wa.me com o código do Brasil e a mensagem codificada', () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    openWhatsapp('62999998888', 'Olá & tchau')
    expect(open).toHaveBeenCalledWith(
      'https://wa.me/5562999998888?text=Ol%C3%A1%20%26%20tchau',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
