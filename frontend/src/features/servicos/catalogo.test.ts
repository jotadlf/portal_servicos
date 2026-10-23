import { beforeEach, describe, expect, it, vi } from 'vitest'

let catalogo: typeof import('./catalogo')

beforeEach(async () => {
  vi.resetModules()
  catalogo = await import('./catalogo')
})

describe('getAllTasks', () => {
  it('junta os serviços de todas as modalidades', () => {
    const total = catalogo.professions.reduce((sum, profession) => sum + profession.tasks.length, 0)
    const tasks = catalogo.getAllTasks()
    expect(tasks).toHaveLength(total)
    expect(tasks).toContainEqual(
      expect.objectContaining({ title: 'Instalar chuveiro', profession: catalogo.findProfession('eletricista') }),
    )
  })
})

describe('addProfession', () => {
  it('gera o id a partir do nome, sem acentos', () => {
    const profession = catalogo.addProfession({ name: ' Técnico de Ar ', tasks: ['Limpar ar-condicionado'] })
    expect(profession).toMatchObject({ id: 'tecnico-de-ar', name: 'Técnico de Ar' })
    expect(catalogo.findProfession('tecnico-de-ar')).toBe(profession)
  })

  it('não repete id já existente', () => {
    expect(catalogo.addProfession({ name: 'Eletricista', tasks: [] }).id).toBe('eletricista-2')
    expect(catalogo.addProfession({ name: 'Eletricista', tasks: [] }).id).toBe('eletricista-3')
  })

  it('usa um id padrão quando o nome não tem letras', () => {
    expect(catalogo.addProfession({ name: '!!!', tasks: [] }).id).toBe('modalidade')
  })
})

describe('removeProfession', () => {
  it('tira a modalidade do catálogo', () => {
    const before = catalogo.professions.length
    catalogo.removeProfession('eletricista')
    expect(catalogo.findProfession('eletricista')).toBeUndefined()
    expect(catalogo.professions).toHaveLength(before - 1)

    catalogo.removeProfession('inexistente')
    expect(catalogo.professions).toHaveLength(before - 1)
  })
})
