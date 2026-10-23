import { describe, expect, it } from 'vitest'
import {
  findPlan,
  getPlans,
  isoDate,
  monthlyValue,
  planPriceLabel,
  planSavings,
  trialEndDate,
  type PlanId,
  type PlanSettings,
} from './plano'

const settings: PlanSettings = {
  monthlyPrice: 19.9,
  semiannualPrice: 99.9,
  trialDays: 15,
  gateway: 'mercadopago',
  pixEnabled: true,
  cardEnabled: true,
}

const plain = (text: string) => text.replace(/\s/g, ' ')

describe('planos', () => {
  it('oferece mensal e semestral com os preços configurados', () => {
    expect(getPlans(settings).map((plan) => [plan.id, plan.price, plan.months])).toEqual([
      ['mensal', 19.9, 1],
      ['semestral', 99.9, 6],
    ])
  })

  it('acompanha os valores da administração', () => {
    const changed = { ...settings, monthlyPrice: 25, semiannualPrice: 120 }
    expect(findPlan(changed, 'mensal').price).toBe(25)
    expect(findPlan(changed, 'semestral').price).toBe(120)
    expect(plain(planPriceLabel(changed))).toBe('R$ 25,00')
  })

  it('cai no mensal quando o plano não existe', () => {
    expect(findPlan(settings, 'anual' as PlanId).id).toBe('mensal')
  })
})

describe('planSavings', () => {
  it('não há economia no mensal', () => {
    expect(planSavings(settings, findPlan(settings, 'mensal'))).toEqual({ amount: 0, percent: 0 })
  })

  it('compara o semestral com 6 meses do mensal', () => {
    const savings = planSavings(settings, findPlan(settings, 'semestral'))
    expect(savings.amount).toBeCloseTo(19.5)
    expect(savings.percent).toBe(16)
  })
})

describe('monthlyValue', () => {
  it('divide o preço pelo período', () => {
    expect(monthlyValue(findPlan(settings, 'mensal'))).toBeCloseTo(19.9)
    expect(monthlyValue(findPlan(settings, 'semestral'))).toBeCloseTo(16.65)
  })
})

describe('trialEndDate', () => {
  it('soma os dias grátis, virando o mês', () => {
    expect(trialEndDate(settings, new Date(2026, 0, 25))).toBe('2026-02-09')
  })

  it('usa os dias configurados', () => {
    expect(trialEndDate({ ...settings, trialDays: 30 }, new Date(2026, 11, 15))).toBe('2027-01-14')
  })
})

describe('isoDate', () => {
  it('usa o dia local, não o UTC', () => {
    expect(isoDate(new Date(2026, 9, 23, 23, 30))).toBe('2026-10-23')
  })
})
