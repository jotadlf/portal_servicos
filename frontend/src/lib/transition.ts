import { flushSync } from 'react-dom'

// Sentido da troca: a tela nova entra pela direita (avançar) ou pela esquerda (voltar).
// Sem sentido, só esmaece.
type Direction = 'avancar' | 'voltar'

// Troca de tela com transição suave (View Transitions). Sem suporte no navegador,
// ou com "reduzir movimento" ligado, a troca acontece na hora, como antes.
export function withTransition(update: () => void, direction?: Direction) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce) {
    update()
    return
  }
  const root = document.documentElement
  if (direction) root.dataset.nav = direction
  const transition = document.startViewTransition(() => flushSync(update))
  transition.finished.finally(() => delete root.dataset.nav)
}
