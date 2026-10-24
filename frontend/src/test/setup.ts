import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

// Os testes do banco (banco/*.test.ts) rodam no Node puro e cuidam do próprio banco;
// o resto é só para os de tela
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  const { closeDb, resetDb } = await import('./supabase')
  const { getSupabaseClient } = await import('../lib/supabase')

  // O jsdom não implementa o <dialog> modal: abrir e fechar só liga o atributo "open"
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }

  // Os gráficos medem a largura com ResizeObserver; no jsdom ficam com a largura padrão
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  URL.createObjectURL ??= () => 'blob:foto-de-teste'
  window.scrollTo = () => {}

  // Telas conversam com o Supabase local de verdade, de volta aos dados de exemplo a cada teste
  beforeAll(() => getSupabaseClient().auth.stopAutoRefresh())
  beforeEach(resetDb)
  afterAll(closeDb)

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.location.hash = ''
    // A sessão do Supabase fica na sessionStorage: limpar = sair
    sessionStorage.clear()
  })
}
