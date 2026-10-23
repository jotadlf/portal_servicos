import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('getSupabaseClient', () => {
  // O cliente fica guardado no módulo; cada teste importa uma cópia nova
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('avisa quando as variáveis de ambiente faltam', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { getSupabaseClient } = await import('./supabase')
    expect(() => getSupabaseClient()).toThrow(/VITE_SUPABASE_URL/)
  })

  it('cria o cliente uma vez e reaproveita', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-de-teste')
    const { getSupabaseClient } = await import('./supabase')
    const client = getSupabaseClient()
    expect(client).toBeDefined()
    expect(getSupabaseClient()).toBe(client)
  })
})
