// Histórico mensal do painel. O protótipo não guarda data de cadastro nem pagamentos,
// então estes números são de exemplo (e a tela avisa isso).
// TODO: trocar por consultas agrupadas por mês no Supabase.

export type MonthPoint = {
  label: string
  // Novos cadastros no mês
  newConsumers: number
  newProviders: number
  // Receita recorrente no fim do mês, em reais
  revenue: number
}

// Do mais antigo ao mês atual (12 meses)
const sample = [
  { newConsumers: 38, newProviders: 6, revenue: 119.4 },
  { newConsumers: 45, newProviders: 9, revenue: 278.6 },
  { newConsumers: 52, newProviders: 8, revenue: 418.0 },
  { newConsumers: 61, newProviders: 12, revenue: 616.9 },
  { newConsumers: 58, newProviders: 11, revenue: 796.0 },
  { newConsumers: 74, newProviders: 15, revenue: 1054.7 },
  { newConsumers: 89, newProviders: 14, revenue: 1293.5 },
  { newConsumers: 97, newProviders: 19, revenue: 1611.9 },
  { newConsumers: 112, newProviders: 21, revenue: 1950.2 },
  { newConsumers: 108, newProviders: 24, revenue: 2328.3 },
  { newConsumers: 131, newProviders: 27, revenue: 2786.0 },
  { newConsumers: 146, newProviders: 31, revenue: 3263.6 },
]

function monthLabel(date: Date) {
  return date
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase())
}

export function monthlyHistory(months: number): MonthPoint[] {
  const now = new Date()
  return sample.slice(-months).map((point, index) => ({
    ...point,
    label: monthLabel(new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1)),
  }))
}
