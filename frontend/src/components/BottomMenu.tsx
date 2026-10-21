import { BriefcaseBusiness, House, UserRound } from 'lucide-react'
import { routes } from '../hooks/useHashRoute'

type BottomMenuProps = {
  current: 'inicio' | 'servicos' | 'conta'
  // Na página inicial, tocar em "Início" também limpa a busca
  onInicio?: () => void
}

export function BottomMenu({ current, onInicio }: BottomMenuProps) {
  return (
    <nav className="menu" aria-label="Menu principal">
      <a
        className="menu-link"
        href={routes.inicio}
        aria-current={current === 'inicio' ? 'page' : undefined}
        aria-label="Início"
        onClick={onInicio}
      >
        <House size={24} strokeWidth={1.75} aria-hidden="true" />
      </a>
      <a
        className="menu-link"
        href={routes.servicos}
        aria-current={current === 'servicos' ? 'page' : undefined}
        aria-label="Serviços"
      >
        <BriefcaseBusiness size={24} strokeWidth={1.75} aria-hidden="true" />
      </a>
      <a
        className="menu-link"
        href={routes.conta}
        aria-current={current === 'conta' ? 'page' : undefined}
        aria-label="Perfil"
      >
        <UserRound size={24} strokeWidth={1.75} aria-hidden="true" />
      </a>
    </nav>
  )
}
