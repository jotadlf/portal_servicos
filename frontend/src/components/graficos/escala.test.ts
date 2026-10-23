import { describe, expect, it } from 'vitest'
import { columnPath, compact, niceTicks } from './escala'

describe('niceTicks', () => {
  it('usa 0 e 1 quando não há valores', () => {
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(-5)).toEqual([0, 1])
  })

  it('arredonda o teto para um passo limpo', () => {
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(3263.6)).toEqual([0, 1000, 2000, 3000, 4000])
  })

  it('respeita a quantidade de intervalos pedida', () => {
    expect(niceTicks(10, 2)).toEqual([0, 5, 10])
  })

  it('sempre cobre o valor máximo', () => {
    for (const max of [1, 3, 19.9, 146, 999, 12345]) {
      const ticks = niceTicks(max)
      expect(ticks[0]).toBe(0)
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max)
    }
  })
})

describe('compact', () => {
  it('abrevia milhares no padrão brasileiro', () => {
    expect(compact(999)).toBe('999')
    // toLocaleString usa espaço não separável antes do "mil"
    expect(compact(1250).replace(/\s/g, ' ')).toBe('1,3 mil')
  })
})

describe('columnPath', () => {
  it('desenha a barra com o topo arredondado', () => {
    expect(columnPath(0, 10, 20, 50)).toBe('M0,50 V14 Q0,10 4,10 H16 Q20,10 20,14 V50 Z')
  })

  it('reduz o raio em barras baixas', () => {
    expect(columnPath(0, 48, 20, 50)).toBe('M0,50 V50 Q0,48 2,48 H18 Q20,48 20,50 V50 Z')
  })
})
