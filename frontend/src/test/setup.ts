import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

// Os testes da API (server/*.test.ts) rodam no Node puro; o resto é só para os de tela
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  const { apiServer, startApi } = await import('./api-server')

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

  // Telas conversam com um servidor de verdade, com SQLite na memória
  beforeAll(startApi)
  beforeEach(() => apiServer().reset())
  afterAll(() => apiServer().close())

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.location.hash = ''
    sessionStorage.clear()
  })
}
