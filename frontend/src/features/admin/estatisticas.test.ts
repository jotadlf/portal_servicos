import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let estatisticas: typeof import('./estatisticas')
let dados: typeof import('../profissionais/dados-exemplo')

beforeEach(async () => {
  vi.resetModules()
  estatisticas = await import('./estatisticas')
  dados = await import('../profissionais/dados-exemplo')
})

afterEach(() => vi.useRealTimers())

describe('getStats', () => {
  it('fecha as contas entre as categorias', () => {
    const stats = estatisticas.getStats()
    expect(stats.accounts).toBe(2)
    expect(stats.consumersOnly).toBe(1)
    expect(stats.published + stats.drafts).toBe(stats.providers)
    expect(stats.inTrial + stats.paying).toBe(stats.published)
    expect(stats.people).toBe(stats.accounts + stats.providers - 1)
    expect(stats.contacts).toBe(dados.contactRequests.length)
    expect(stats.reviews).toBe(dados.reviews.length)
  })

  it('separa período grátis de quem paga e soma a receita mensal equivalente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'))
    const base = estatisticas.getStats()

    dados.updateProfessional('p1', { trialEndsAt: '2026-11-01' })
    dados.updateProfessional('p4', { plan: 'semestral' })
    const stats = estatisticas.getStats()

    expect(stats.inTrial).toBe(base.inTrial + 1)
    expect(stats.paying).toBe(base.paying - 1)
    // p1 deixa de pagar o mensal e p4 troca o mensal pelo semestral (99,90 / 6)
    expect(stats.monthlyRevenue).toBeCloseTo(base.monthlyRevenue - 19.9 - 19.9 + 16.65)
  })

  it('período grátis vencido volta a contar como pagante', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'))
    const base = estatisticas.getStats()
    dados.updateProfessional('p1', { trialEndsAt: '2026-10-01' })
    expect(estatisticas.getStats().inTrial).toBe(base.inTrial)
  })
})

describe('servicesByProfession', () => {
  it('ordena da modalidade com mais serviços para a com menos', () => {
    const rows = estatisticas.servicesByProfession()
    const counts = rows.map((row) => row.services)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    const eletricista = rows.find((row) => row.profession.id === 'eletricista')!
    expect(eletricista.providers).toBeGreaterThan(0)
    expect(eletricista.services).toBeGreaterThanOrEqual(eletricista.providers)
  })
})
