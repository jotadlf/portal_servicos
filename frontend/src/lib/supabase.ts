import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Avisa o app quando a sessão some (venceu ou foi encerrada em outro lugar)
export const SESSION_EXPIRED = 'portal:sessao-expirada'

// Onde a sessão fica guardada
export const SESSION_KEY = 'portal.sessao'

// A sessão fica na sessionStorage: vale só nesta aba, como antes, e sobrevive ao recarregar.
// Sem sessionStorage (modo privado restrito), fica na memória até recarregar.
function tabStorage() {
  try {
    sessionStorage.setItem('portal.teste', '1')
    sessionStorage.removeItem('portal.teste')
    return sessionStorage
  } catch {
    const memory = new Map<string, string>()
    return {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    }
  }
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo frontend/.env.local.',
    )
  }

  client = createClient(url, anonKey, {
    auth: { storage: tabStorage(), storageKey: SESSION_KEY, persistSession: true, autoRefreshToken: true },
  })
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.dispatchEvent(new Event(SESSION_EXPIRED))
  })
  return client
}
