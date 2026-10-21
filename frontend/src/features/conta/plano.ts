// Plano de prestador: usar o app é grátis; aparecer nas buscas é pago.
export const PLAN_PRICE = 19.9
export const TRIAL_DAYS = 15

export function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const planPriceLabel = formatMoney(PLAN_PRICE)

export type PlanId = 'mensal' | 'semestral'

export type Plan = {
  id: PlanId
  label: string
  // Valor de cada cobrança e de quantos em quantos meses ela se repete
  price: number
  months: number
  period: string
  // Para frases: "a cobrança se repete todo mês"
  every: string
}

export const plans: Plan[] = [
  { id: 'mensal', label: 'Mensal', price: PLAN_PRICE, months: 1, period: 'por mês', every: 'todo mês' },
  { id: 'semestral', label: 'Semestral', price: 99.9, months: 6, period: 'a cada 6 meses', every: 'a cada 6 meses' },
]

export function findPlan(id: PlanId) {
  return plans.find((plan) => plan.id === id) ?? plans[0]
}

// Quanto o plano economiza em relação a pagar o mensal pelo mesmo período
export function planSavings(plan: Plan) {
  const full = PLAN_PRICE * plan.months
  return { amount: full - plan.price, percent: Math.round((1 - plan.price / full) * 100) }
}

// Data (AAAA-MM-DD) em que o período grátis termina, contando a partir de hoje
export function trialEndDate(from = new Date()) {
  const end = new Date(from)
  end.setDate(end.getDate() + TRIAL_DAYS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
}
