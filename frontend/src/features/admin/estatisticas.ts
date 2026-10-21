// Números do painel de administração, calculados a partir dos dados do protótipo
import { findPlan, monthlyValue } from '../conta/plano'
import { getAccounts } from '../conta/usuario'
import {
  contactRequests,
  professionals,
  reviews,
} from '../profissionais/dados-exemplo'
import { professions } from '../servicos/catalogo'

export function getStats() {
  const accounts = getAccounts().filter((account) => !account.isAdmin)
  const published = professionals.filter((pro) => pro.status === 'publicado')
  const today = new Date().toISOString().slice(0, 10)
  const inTrial = published.filter((pro) => pro.trialEndsAt && pro.trialEndsAt > today)
  const paying = published.filter((pro) => !inTrial.includes(pro))

  return {
    accounts: accounts.length,
    // Prestadores de exemplo não têm conta de login; contam como cadastrados
    people: accounts.length + professionals.filter(
      (pro) => !accounts.some((account) => account.professionalId === pro.id),
    ).length,
    consumersOnly: accounts.filter((account) => !account.professionalId).length,
    providers: professionals.length,
    published: published.length,
    drafts: professionals.length - published.length,
    inTrial: inTrial.length,
    paying: paying.length,
    services: professionals.reduce((total, pro) => total + pro.services.length, 0),
    modalities: professions.length,
    contacts: contactRequests.length,
    reviews: reviews.length,
    // Receita mensal recorrente: planos semestrais entram pelo valor equivalente por mês
    monthlyRevenue: paying.reduce(
      (total, pro) => total + monthlyValue(findPlan(pro.plan ?? 'mensal')),
      0,
    ),
  }
}

// Serviços oferecidos por modalidade, do maior para o menor
export function servicesByProfession() {
  return professions
    .map((profession) => ({
      profession,
      services: professionals.reduce(
        (total, pro) =>
          total + pro.services.filter((service) => service.professionId === profession.id).length,
        0,
      ),
      providers: professionals.filter((pro) =>
        pro.services.some((service) => service.professionId === profession.id),
      ).length,
    }))
    .sort((a, b) => b.services - a.services)
}
