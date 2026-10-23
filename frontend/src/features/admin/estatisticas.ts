// Números do painel de administração, calculados no servidor a partir do banco
import { api } from '../../lib/api'

export type Stats = {
  accounts: number
  people: number
  consumersOnly: number
  providers: number
  published: number
  drafts: number
  inTrial: number
  paying: number
  services: number
  modalities: number
  contacts: number
  reviews: number
  monthlyRevenue: number
}

// Serviços oferecidos por modalidade, do maior para o menor
export type RankingRow = { professionId: string; name: string; services: number; providers: number }

export function fetchStats() {
  return api<{ stats: Stats; ranking: RankingRow[] }>('GET', '/api/admin/estatisticas')
}
