import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Professional } from './dados-exemplo'

let dados: typeof import('./dados-exemplo')

beforeEach(async () => {
  vi.resetModules()
  dados = await import('./dados-exemplo')
})

describe('reputation', () => {
  const pro = (rating: number, reviews: number) => ({ rating, reviews }) as Professional

  it('puxa poucas avaliações para a média geral', () => {
    expect(dados.reputation(pro(0, 0))).toBe(4)
    expect(dados.reputation(pro(4.9, 132))).toBeGreaterThan(dados.reputation(pro(5, 3)))
  })
})

describe('professionalsFor', () => {
  it('lista só publicados que fazem o serviço, da melhor reputação para a pior', () => {
    const list = dados.professionalsFor('eletricista', 'Instalar chuveiro')
    expect(list.length).toBeGreaterThan(0)
    expect(list.map((pro) => pro.id)).toContain('p1')
    for (const pro of list) {
      expect(pro.status).toBe('publicado')
      expect(dados.priceFor(pro, 'Instalar chuveiro')).not.toBeUndefined()
    }
    const scores = list.map(dados.reputation)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('esconde rascunhos', () => {
    dados.updateProfessional('p1', { status: 'rascunho' })
    expect(dados.professionalsFor('eletricista', 'Instalar chuveiro').map((pro) => pro.id)).not.toContain('p1')
  })
})

describe('priceFor e professionIdsOf', () => {
  it('informa o preço do serviço ou null', () => {
    const carlos = dados.getProfessional('p1')!
    expect(dados.priceFor(carlos, 'Instalar chuveiro')).toBe(150)
    expect(dados.priceFor(carlos, 'Pintar parede')).toBeNull()
    expect(dados.professionIdsOf(carlos)).toEqual(['eletricista'])
  })
})

describe('removeServicesOf', () => {
  it('tira os serviços da modalidade de todos os perfis', () => {
    dados.removeServicesOf('eletricista')
    expect(dados.professionals.flatMap((pro) => pro.services).some((s) => s.professionId === 'eletricista')).toBe(false)
  })
})

describe('reviewsFor e contactsFor', () => {
  it('filtram pelo prestador', () => {
    expect(dados.reviewsFor('p1').every((review) => review.professionalId === 'p1')).toBe(true)
    expect(dados.reviewsFor('p1')).toHaveLength(4)
    expect(dados.contactsFor('p1')).toHaveLength(4)
    expect(dados.contactsFor('p2')).toHaveLength(0)
  })
})
