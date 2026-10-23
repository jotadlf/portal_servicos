// Prestadores, serviços, avaliações e contatos, lidos e gravados pela API.
import { api } from '../../lib/api'
import type { PlanId } from '../conta/plano'

// Serviço oferecido e o preço médio informado pelo profissional (em reais).
// Preço null = o profissional não informou; o valor sai só na conversa.
// hidden = há preço, mas ele só vem para quem entrou na conta.
export type OfferedService = {
  professionId: string
  name: string
  price: number | null
  hidden?: boolean
}

export type Professional = {
  id: string
  // Sem login, só o primeiro nome
  name: string
  // Uma pessoa pode oferecer serviços de várias profissões
  services: OfferedService[]
  photo?: string
  // Rascunho não aparece nas buscas; publicar ativa o plano de prestador
  status: 'rascunho' | 'publicado'
  // Fim do período grátis (AAAA-MM-DD), definido ao publicar
  trialEndsAt?: string
  plan?: PlanId
  rating: number
  reviews: number
  neighborhood: string
  about?: string
  // Só dígitos, com DDD; só vem para quem entrou na conta
  whatsapp?: string
}

export type Review = {
  id: string
  professionalId: string
  author: string
  rating: number
  comment: string
  date: string
}

export type ContactRequest = {
  id: string
  professionalId: string
  client: string
  task: string
  message: string
  neighborhood: string
  date: string
  answered: boolean
}

export function serviceFor(pro: Professional, task: string) {
  return pro.services.find((service) => service.name === task)
}

export function professionIdsOf(pro: Professional) {
  return [...new Set(pro.services.map((service) => service.professionId))]
}

// Publicados que fazem o serviço, da melhor reputação para a pior (ordenados no servidor)
export function fetchProfessionalsFor(professionId: string, task: string) {
  const query = new URLSearchParams({ profissao: professionId, servico: task })
  return api<Professional[]>('GET', `/api/prestadores?${query}`)
}

export function fetchProfessional(id: string) {
  return api<Professional>('GET', `/api/prestadores/${encodeURIComponent(id)}`)
}

export function fetchReviews(id: string) {
  return api<Review[]>('GET', `/api/prestadores/${encodeURIComponent(id)}/avaliacoes`)
}

// Perfil de prestador de quem está na conta
export function fetchOwnProfessional() {
  return api<Professional>('GET', '/api/prestador')
}

export function saveServices(services: OfferedService[]) {
  return api<Professional>('PUT', '/api/prestador/servicos', {
    services: services.map(({ professionId, name, price }) => ({ professionId, name, price })),
  })
}

export function saveAbout(about: string) {
  return api<{ about: string }>('PATCH', '/api/prestador/sobre', { about })
}

export function publishProfile(plan: PlanId, method: 'pix' | 'cartao') {
  return api<{ status: 'publicado'; plan: PlanId; trialEndsAt: string }>('POST', '/api/prestador/publicar', {
    plan,
    method,
  })
}

export function fetchContacts() {
  return api<ContactRequest[]>('GET', '/api/prestador/contatos')
}

export function markContactAnswered(id: string) {
  return api('PATCH', `/api/prestador/contatos/${encodeURIComponent(id)}`, {})
}
