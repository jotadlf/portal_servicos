import { afterEach, describe, expect, it } from 'vitest'
import {
  findPlan,
  getPlanSettings,
  getPlans,
  monthlyValue,
  planPriceLabel,
  planSavings,
  trialEndDate,
  updatePlanSettings,
  type PlanId,
} from './plano'

const original = { ...getPlanSettings() }
afterEach(() => updatePlanSettings(original))

const plain = (text: string) => text.replace(/\s/g, ' ')

describe('planos', () => {
  it('oferece mensal e semestral com os preços configurados', () => {
    expect(getPlans().map((plan) => [plan.id, plan.price, plan.months])).toEqual([
      ['mensal', 19.9, 1],
      ['semestral', 99.9, 6],
    ])
  })

  it('acompanha a alteração dos valores na administração', () => {
    updatePlanSettings({ monthlyPrice: 25, semiannualPrice: 120 })
    expect(findPlan('mensal').price).toBe(25)
    expect(findPlan('semestral').price).toBe(120)
    expect(plain(planPriceLabel())).toBe('R$ 25,00')
  })

  it('cai no mensal quando o plano não existe', () => {
    expect(findPlan('anual' as PlanId).id).toBe('mensal')
  })
})

describe('planSavings', () => {
  it('não há economia no mensal', () => {
    expect(planSavings(findPlan('mensal'))).toEqual({ amount: 0, percent: 0 })
  })

  it('compara o semestral com 6 meses do mensal', () => {
    const savings = planSavings(findPlan('semestral'))
    expect(savings.amount).toBeCloseTo(19.5)
    expect(savings.percent).toBe(16)
  })
})

describe('monthlyValue', () => {
  it('divide o preço pelo período', () => {
    expect(monthlyValue(findPlan('mensal'))).toBeCloseTo(19.9)
    expect(monthlyValue(findPlan('semestral'))).toBeCloseTo(16.65)
  })
})

describe('trialEndDate', () => {
  it('soma os dias grátis, virando o mês', () => {
    expect(trialEndDate(new Date(2026, 0, 25))).toBe('2026-02-09')
  })

  it('usa os dias configurados', () => {
    updatePlanSettings({ trialDays: 30 })
    expect(trialEndDate(new Date(2026, 11, 15))).toBe('2027-01-14')
  })
})
