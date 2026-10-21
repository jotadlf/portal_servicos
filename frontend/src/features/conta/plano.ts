// Plano de prestador: usar o app é grátis; aparecer nas buscas é pago.
// Os valores são editados na tela de administração.

export type PaymentGateway = 'mercadopago' | 'stripe' | 'pagseguro'

export const gateways: { id: PaymentGateway; label: string }[] = [
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'pagseguro', label: 'PagBank (PagSeguro)' },
]

export type PlanSettings = {
  monthlyPrice: number
  semiannualPrice: number
  trialDays: number
  gateway: PaymentGateway
  pixEnabled: boolean
  cardEnabled: boolean
}

// Protótipo: em memória. TODO: tabela de configurações no Supabase, editável só por admin.
const settings: PlanSettings = {
  monthlyPrice: 19.9,
  semiannualPrice: 99.9,
  trialDays: 15,
  gateway: 'mercadopago',
  pixEnabled: true,
  cardEnabled: true,
}

export function getPlanSettings() {
  return settings
}

export function updatePlanSettings(changes: Partial<PlanSettings>) {
  Object.assign(settings, changes)
}

export function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function planPriceLabel() {
  return formatMoney(settings.monthlyPrice)
}

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

export function getPlans(): Plan[] {
  return [
    {
      id: 'mensal',
      label: 'Mensal',
      price: settings.monthlyPrice,
      months: 1,
      period: 'por mês',
      every: 'todo mês',
    },
    {
      id: 'semestral',
      label: 'Semestral',
      price: settings.semiannualPrice,
      months: 6,
      period: 'a cada 6 meses',
      every: 'a cada 6 meses',
    },
  ]
}

export function findPlan(id: PlanId) {
  const plans = getPlans()
  return plans.find((plan) => plan.id === id) ?? plans[0]
}

// Quanto o plano economiza em relação a pagar o mensal pelo mesmo período
export function planSavings(plan: Plan) {
  const full = settings.monthlyPrice * plan.months
  return { amount: full - plan.price, percent: Math.round((1 - plan.price / full) * 100) }
}

// Valor mensal equivalente, para somar a receita de planos diferentes
export function monthlyValue(plan: Plan) {
  return plan.price / plan.months
}

// Data (AAAA-MM-DD) em que o período grátis termina, contando a partir de hoje
export function trialEndDate(from = new Date()) {
  const end = new Date(from)
  end.setDate(end.getDate() + settings.trialDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
}
