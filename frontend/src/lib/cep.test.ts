import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAddress, formatCep, isValidUf } from './cep'

describe('isValidUf', () => {
  it('aceita as siglas dos estados, em qualquer caixa', () => {
    expect(isValidUf('GO')).toBe(true)
    expect(isValidUf('df')).toBe(true)
    expect(isValidUf(' sp ')).toBe(true)
  })

  it('recusa siglas que não existem', () => {
    expect(isValidUf('XY')).toBe(false)
    expect(isValidUf('G')).toBe(false)
    expect(isValidUf('')).toBe(false)
  })
})

describe('formatCep', () => {
  it('aplica a máscara 00000-000', () => {
    expect(formatCep('74')).toBe('74')
    expect(formatCep('74215')).toBe('74215')
    expect(formatCep('742150')).toBe('74215-0')
    expect(formatCep('74215-010')).toBe('74215-010')
    expect(formatCep('742150109999')).toBe('74215-010')
  })
})

describe('fetchAddress', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(response: Partial<Response> | Error) {
    const fetch = vi.fn(() =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
    )
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('não consulta CEP incompleto', async () => {
    const fetch = mockFetch({ ok: true })
    expect(await fetchAddress('7421')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('converte a resposta do ViaCEP', async () => {
    const fetch = mockFetch({
      ok: true,
      json: async () => ({ logradouro: 'Rua T-30', bairro: 'Setor Bueno', localidade: 'Goiânia', uf: 'GO' }),
    })
    expect(await fetchAddress('74215-010')).toEqual({
      street: 'Rua T-30',
      neighborhood: 'Setor Bueno',
      city: 'Goiânia',
      state: 'GO',
    })
    expect(fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/74215010/json/')
  })

  it('preenche campos ausentes com texto vazio', async () => {
    mockFetch({ ok: true, json: async () => ({ localidade: 'Goiânia', uf: 'GO' }) })
    expect(await fetchAddress('74000000')).toEqual({
      street: '',
      neighborhood: '',
      city: 'Goiânia',
      state: 'GO',
    })
  })

  it('devolve null para CEP inexistente, erro HTTP ou falha de rede', async () => {
    mockFetch({ ok: true, json: async () => ({ erro: true }) })
    expect(await fetchAddress('00000000')).toBeNull()

    mockFetch({ ok: false })
    expect(await fetchAddress('74215010')).toBeNull()

    mockFetch(new Error('offline'))
    expect(await fetchAddress('74215010')).toBeNull()
  })
})
