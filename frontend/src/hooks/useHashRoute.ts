import { useEffect, useState } from 'react'

export type Route =
  | { name: 'inicio' }
  | { name: 'perfil'; id: string }
  | { name: 'area' }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'prestador' && parts[1]) return { name: 'perfil', id: parts[1] }
  if (parts[0] === 'area') return { name: 'area' }
  return { name: 'inicio' }
}

// Rotas pelo "#" da URL: funcionam no PWA e no GitHub Pages sem configurar o servidor
export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash))

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
  area: '#/area',
}
