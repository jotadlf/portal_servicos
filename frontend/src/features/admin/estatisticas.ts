// Números do painel de administração, calculados no banco
import { rpc } from '../../lib/api'

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
  return rpc<{ stats: Stats; ranking: RankingRow[] }>('estatisticas')
}
