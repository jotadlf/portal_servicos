// Pedidos sobre os próprios dados (LGPD art. 18): a pessoa envia pelo app, a administração
// responde por e-mail e marca como respondido.
import { rpc } from '../../lib/api'

export const SUBJECTS = [
  { id: 'acesso', label: 'Ver quais dados vocês têm sobre mim' },
  { id: 'correcao', label: 'Corrigir meus dados' },
  { id: 'exclusao', label: 'Apagar meus dados' },
  { id: 'duvida', label: 'Dúvida sobre privacidade' },
  { id: 'outro', label: 'Outro assunto' },
] as const

export type Subject = (typeof SUBJECTS)[number]['id']

export const MAX_MESSAGE = 1000
// Prazo da LGPD (art. 19, II) para responder ao titular
export const RESPONSE_DAYS = 15

export type DataRequest = {
  id: string
  subject: Subject
  message: string
  createdAt: string
  answeredAt?: string
}

// O que a administração vê: quem pediu, para responder por e-mail
export type AdminDataRequest = DataRequest & { name: string; email: string }

export function subjectLabel(subject: Subject) {
  return SUBJECTS.find(({ id }) => id === subject)?.label ?? subject
}

// Data limite para responder: 15 dias depois do pedido
export function responseDeadline(createdAt: string) {
  const date = new Date(createdAt)
  date.setDate(date.getDate() + RESPONSE_DAYS)
  return date
}

// "10 de nov. de 2026", no horário de Brasília
export function formatRequestDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export function sendDataRequest(subject: Subject, message: string) {
  return rpc<DataRequest>('enviar_pedido', { subject, message: message.trim() })
}

export function fetchMyDataRequests() {
  return rpc<DataRequest[]>('meus_pedidos')
}

export function fetchAllDataRequests() {
  return rpc<AdminDataRequest[]>('pedidos_admin')
}

export function markDataRequestAnswered(id: string) {
  return rpc<DataRequest>('marcar_pedido_respondido', { id })
}
