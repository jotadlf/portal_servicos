import { describe, expect, it } from 'vitest'
import { parse, routes } from './useHashRoute'

describe('parse', () => {
  it('reconhece cada rota', () => {
    expect(parse('')).toEqual({ name: 'inicio' })
    expect(parse('#/')).toEqual({ name: 'inicio' })
    expect(parse('#/prestador/p1')).toEqual({ name: 'perfil', id: 'p1' })
    expect(parse('#/servicos')).toEqual({ name: 'servicos' })
    expect(parse('#/conta')).toEqual({ name: 'conta' })
    expect(parse('#/publicar')).toEqual({ name: 'publicar' })
    expect(parse('#/admin')).toEqual({ name: 'admin' })
    expect(parse('#/entrar')).toEqual({ name: 'entrar', mode: 'login' })
    expect(parse('#/cadastro')).toEqual({ name: 'entrar', mode: 'cadastro' })
  })

  it('mantém o link antigo da Área do prestador', () => {
    expect(parse('#/area')).toEqual({ name: 'servicos' })
  })

  it('manda para o início o que não conhece ou está incompleto', () => {
    expect(parse('#/prestador')).toEqual({ name: 'inicio' })
    expect(parse('#/qualquer-coisa')).toEqual({ name: 'inicio' })
  })

  it('aceita o hash sem a barra', () => {
    expect(parse('#conta')).toEqual({ name: 'conta' })
  })
})

describe('routes', () => {
  it('gera links que voltam para a mesma rota', () => {
    expect(parse(routes.perfil('p7'))).toEqual({ name: 'perfil', id: 'p7' })
    expect(parse(routes.admin)).toEqual({ name: 'admin' })
    expect(parse(routes.cadastro)).toEqual({ name: 'entrar', mode: 'cadastro' })
  })
})
