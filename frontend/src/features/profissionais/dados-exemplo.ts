import type { PlanId } from '../conta/plano'

// Dados de exemplo para o protótipo. Serão substituídos pela tabela de
// profissionais no Supabase.

// Serviço oferecido e o preço médio informado pelo profissional (em reais).
// Preço null = o profissional não informou; o valor sai só na conversa.
export type OfferedService = {
  professionId: string
  name: string
  price: number | null
}

export type Professional = {
  id: string
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
  // Só dígitos, com DDD. Nos dados de exemplo fica vazio de propósito:
  // número inventado poderia levar o cliente ao WhatsApp de um desconhecido.
  whatsapp?: string
}

type SampleRow = Omit<Professional, 'services' | 'status'> & {
  professionId: string
  prices: Record<string, number | null>
}

const sampleRows: SampleRow[] = [
  { id: 'p1', name: 'Carlos Henrique', professionId: 'eletricista', prices: { 'Instalar chuveiro': 150, 'Trocar tomada ou interruptor': 60, 'Revisar quadro de energia': 250 }, rating: 4.9, reviews: 132, neighborhood: 'Setor Bueno', about: 'Eletricista há 15 anos, atendo casas e apartamentos na região sul. Levo o material básico e deixo tudo limpo no final.' },
  { id: 'p2', name: 'Marcos Vinícius', professionId: 'eletricista', prices: { 'Instalar chuveiro': 120, 'Trocar tomada ou interruptor': 50 }, rating: 4.7, reviews: 58, neighborhood: 'Jardim América' },
  { id: 'p3', name: 'Rafael Souza', professionId: 'eletricista', prices: { 'Instalar chuveiro': null, 'Trocar tomada ou interruptor': 70, 'Revisar quadro de energia': null }, rating: 5, reviews: 3, neighborhood: 'Setor Oeste' },
  { id: 'p4', name: 'Maria das Graças', professionId: 'faxineira', prices: { 'Faxina completa': 220, 'Limpeza pós-obra': 350, 'Limpeza de vidros': 150 }, rating: 4.8, reviews: 210, neighborhood: 'Setor Marista', about: 'Faço faxina com produtos próprios. Atendo de segunda a sábado.' },
  { id: 'p5', name: 'Joana Pereira', professionId: 'faxineira', prices: { 'Faxina completa': 180, 'Limpeza de vidros': 120 }, rating: 4.6, reviews: 74, neighborhood: 'Setor Bueno' },
  { id: 'p6', name: 'Luciana Alves', professionId: 'faxineira', prices: { 'Faxina completa': 200, 'Limpeza pós-obra': null, 'Limpeza de vidros': 130 }, rating: 4.9, reviews: 41, neighborhood: 'Vila Nova' },
  { id: 'p7', name: 'Ana Cláudia', professionId: 'diarista', prices: { 'Diária de limpeza': 160, 'Passar roupa': 120, 'Organizar armários': 140 }, rating: 4.9, reviews: 156, neighborhood: 'Setor Sul' },
  { id: 'p8', name: 'Rosângela Lima', professionId: 'diarista', prices: { 'Diária de limpeza': 150, 'Passar roupa': 100 }, rating: 4.5, reviews: 89, neighborhood: 'Jardim Goiás' },
  { id: 'p9', name: 'Francisca Melo', professionId: 'diarista', prices: { 'Diária de limpeza': 170, 'Passar roupa': null, 'Organizar armários': 150 }, rating: 4.8, reviews: 12, neighborhood: 'Setor Oeste' },
  { id: 'p10', name: 'José Antônio', professionId: 'encanador', prices: { 'Consertar vazamento': 140, 'Trocar torneira': 80, 'Desentupir pia ou ralo': 120 }, rating: 4.8, reviews: 97, neighborhood: 'Setor Coimbra' },
  { id: 'p11', name: 'Paulo Roberto', professionId: 'encanador', prices: { 'Consertar vazamento': 130, 'Desentupir pia ou ralo': 100 }, rating: 4.6, reviews: 143, neighborhood: 'Setor Bueno' },
  { id: 'p12', name: 'Diego Martins', professionId: 'encanador', prices: { 'Consertar vazamento': null, 'Trocar torneira': 70, 'Desentupir pia ou ralo': 90 }, rating: 4.2, reviews: 20, neighborhood: 'Vila Nova' },
  { id: 'p13', name: 'Antônio Carlos', professionId: 'pedreiro', prices: { 'Assentar piso': 60, 'Rebocar parede': 45, 'Pequena reforma': null }, rating: 4.7, reviews: 64, neighborhood: 'Jardim América' },
  { id: 'p14', name: 'Sebastião Ribeiro', professionId: 'pedreiro', prices: { 'Assentar piso': 55, 'Pequena reforma': null }, rating: 4.9, reviews: 37, neighborhood: 'Setor Sul' },
  { id: 'p15', name: 'Wesley Gomes', professionId: 'pedreiro', prices: { 'Assentar piso': 50, 'Rebocar parede': 40, 'Pequena reforma': null }, rating: 4.4, reviews: 15, neighborhood: 'Setor Campinas' },
  { id: 'p16', name: 'Fernando Dias', professionId: 'pintor', prices: { 'Pintar cômodo': 450, 'Pintar portão': 250, 'Aplicar textura': 600 }, rating: 4.8, reviews: 112, neighborhood: 'Setor Marista' },
  { id: 'p17', name: 'Leandro Costa', professionId: 'pintor', prices: { 'Pintar cômodo': 400, 'Aplicar textura': 550 }, rating: 4.6, reviews: 45, neighborhood: 'Setor Bueno' },
  { id: 'p18', name: 'Thiago Rocha', professionId: 'pintor', prices: { 'Pintar cômodo': 380, 'Pintar portão': null, 'Aplicar textura': null }, rating: 5, reviews: 6, neighborhood: 'Jardim Goiás' },
  { id: 'p19', name: 'Bruno Teixeira', professionId: 'montador', prices: { 'Montar guarda-roupa': 200, 'Instalar painel de TV': 120, 'Montar cozinha': 450 }, rating: 4.9, reviews: 188, neighborhood: 'Setor Oeste' },
  { id: 'p20', name: 'Gustavo Nunes', professionId: 'montador', prices: { 'Montar guarda-roupa': 180, 'Montar cozinha': 400 }, rating: 4.5, reviews: 60, neighborhood: 'Setor Coimbra' },
  { id: 'p21', name: 'João Batista', professionId: 'jardineiro', prices: { 'Podar árvores': 180, 'Plantar grama': null, 'Limpar lote': 250 }, rating: 4.7, reviews: 52, neighborhood: 'Jardim América' },
  { id: 'p22', name: 'Edson Ferreira', professionId: 'jardineiro', prices: { 'Podar árvores': 150, 'Limpar lote': 220 }, rating: 4.8, reviews: 23, neighborhood: 'Setor Campinas' },
  { id: 'p23', name: 'Ricardo Lopes', professionId: 'chaveiro', prices: { 'Abrir porta': 120, 'Trocar fechadura': 150, 'Fazer cópia de chave': 15 }, rating: 4.9, reviews: 301, neighborhood: 'Setor Central', about: 'Atendimento 24 horas para abertura de portas.' },
  { id: 'p24', name: 'Mateus Freitas', professionId: 'chaveiro', prices: { 'Fazer cópia de chave': 12, 'Trocar fechadura': 140 }, rating: 4.4, reviews: 76, neighborhood: 'Setor Sul' },
]

export const professionals: Professional[] = sampleRows.map(({ professionId, prices, ...rest }) => ({
  ...rest,
  status: 'publicado',
  services: Object.entries(prices).map(([name, price]) => ({ professionId, name, price })),
}))

export function priceFor(pro: Professional, task: string) {
  return pro.services.find((service) => service.name === task)?.price ?? null
}

export function professionIdsOf(pro: Professional) {
  return [...new Set(pro.services.map((service) => service.professionId))]
}

// Média bayesiana: poucas avaliações puxam a nota para a média geral,
// para que 5,0 com 3 avaliações não passe na frente de 4,9 com 132.
const PRIOR_REVIEWS = 10
const PRIOR_RATING = 4

export function reputation({ rating, reviews }: Professional) {
  return (rating * reviews + PRIOR_RATING * PRIOR_REVIEWS) / (reviews + PRIOR_REVIEWS)
}

export function professionalsFor(professionId: string, task: string) {
  return professionals
    .filter((p) =>
      p.status === 'publicado' &&
      p.services.some((service) => service.professionId === professionId && service.name === task),
    )
    .sort((a, b) => reputation(b) - reputation(a))
}

export function getProfessional(id: string) {
  return professionals.find((p) => p.id === id)
}

// Protótipo: altera o perfil só em memória, até recarregar a página.
// TODO: gravar no Supabase.
export function updateProfessional(id: string, changes: Partial<Omit<Professional, 'id'>>) {
  const professional = getProfessional(id)
  if (professional) Object.assign(professional, changes)
}

// Prestador novo: começa sem serviços e sem avaliações
export function addProfessional(
  data: Pick<Professional, 'name' | 'neighborhood' | 'whatsapp' | 'photo'>,
) {
  const professional: Professional = {
    ...data,
    id: `p${Date.now()}`,
    services: [],
    status: 'rascunho',
    rating: 0,
    reviews: 0,
  }
  professionals.push(professional)
  return professional
}

export type Review = {
  id: string
  professionalId: string
  author: string
  rating: number
  comment: string
  date: string
}

export const reviews: Review[] = [
  { id: 'r1', professionalId: 'p1', author: 'Fernanda', rating: 5, comment: 'Instalou o chuveiro rapidinho e explicou tudo. Muito educado.', date: '2026-10-12' },
  { id: 'r2', professionalId: 'p1', author: 'Roberto', rating: 5, comment: 'Chegou no horário combinado e o preço foi o que tinha falado.', date: '2026-10-03' },
  { id: 'r3', professionalId: 'p1', author: 'Juliana', rating: 4, comment: 'Bom serviço, só demorou um pouco para responder.', date: '2026-09-21' },
  { id: 'r4', professionalId: 'p1', author: 'Marcelo', rating: 5, comment: 'Resolveu um problema no quadro que outro eletricista não achou.', date: '2026-09-08' },
  { id: 'r5', professionalId: 'p4', author: 'Patrícia', rating: 5, comment: 'Casa impecável. Já marquei de novo.', date: '2026-10-10' },
  { id: 'r6', professionalId: 'p4', author: 'Lucas', rating: 4, comment: 'Caprichosa e pontual.', date: '2026-09-30' },
  { id: 'r7', professionalId: 'p23', author: 'Carla', rating: 5, comment: 'Abriu a porta em dez minutos, de madrugada.', date: '2026-10-15' },
]

export function reviewsFor(professionalId: string) {
  return reviews.filter((review) => review.professionalId === professionalId)
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

export const contactRequests: ContactRequest[] = [
  { id: 'c1', professionalId: 'p1', client: 'Beatriz', task: 'Instalar chuveiro', message: 'Chuveiro novo de 220V, o antigo queimou.', neighborhood: 'Setor Bueno', date: '2026-10-19', answered: false },
  { id: 'c2', professionalId: 'p1', client: 'André', task: 'Revisar quadro de energia', message: 'O disjuntor desarma quando ligo o forno.', neighborhood: 'Setor Marista', date: '2026-10-18', answered: false },
  { id: 'c3', professionalId: 'p1', client: 'Sônia', task: 'Trocar tomada ou interruptor', message: 'São 4 tomadas na sala e 2 interruptores.', neighborhood: 'Setor Oeste', date: '2026-10-15', answered: true },
  { id: 'c4', professionalId: 'p1', client: 'Gabriel', task: 'Instalar chuveiro', message: '', neighborhood: 'Jardim América', date: '2026-10-11', answered: true },
]

export function contactsFor(professionalId: string) {
  return contactRequests.filter((contact) => contact.professionalId === professionalId)
}
