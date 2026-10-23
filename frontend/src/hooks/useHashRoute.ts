import { useEffect, useState } from 'react'

export type Route =
  | { name: 'inicio' }
  | { name: 'perfil'; id: string }
  | { name: 'servicos' }
  | { name: 'conta' }
  | { name: 'publicar' }
  | { name: 'admin' }
  | { name: 'entrar'; mode: 'login' | 'cadastro' }

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'prestador' && parts[1]) return { name: 'perfil', id: parts[1] }
  // "#/area" era a antiga Área do prestador
  if (parts[0] === 'servicos' || parts[0] === 'area') return { name: 'servicos' }
  if (parts[0] === 'conta') return { name: 'conta' }
  if (parts[0] === 'publicar') return { name: 'publicar' }
  if (parts[0] === 'admin') return { name: 'admin' }
  if (parts[0] === 'entrar') return { name: 'entrar', mode: 'login' }
  if (parts[0] === 'cadastro') return { name: 'entrar', mode: 'cadastro' }
  return { name: 'inicio' }
}

// Rotas pelo "#" da URL: funcionam no PWA e no GitHub Pages sem configurar o servidor
export function useHashRoute() {
  const [route, setRoute] = useState(() => {
    // "/admin" digitado sem o "#" vira "#/admin"
    if (!window.location.hash && /\/admin\/?$/.test(window.location.pathname)) {
      window.history.replaceState(null, '', `/${routes.admin}`)
    }
    return parse(window.location.hash)
  })

  useEffect(() => {
    function handleChange() {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', handleChange)
    return () => window.removeEventListener('hashchange', handleChange)
  }, [])

  return route
}

export const routes = {
  inicio: '#/',
  perfil: (id: string) => `#/prestador/${id}`,
  servicos: '#/servicos',
  conta: '#/conta',
  publicar: '#/publicar',
  admin: '#/admin',
  entrar: '#/entrar',
  cadastro: '#/cadastro',
}
