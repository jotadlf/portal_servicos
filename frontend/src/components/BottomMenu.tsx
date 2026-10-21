import { BriefcaseBusiness, House, LayoutDashboard, UserRound } from 'lucide-react'
import { routes } from '../hooks/useHashRoute'

type BottomMenuProps = {
  current: 'inicio' | 'servicos' | 'conta' | 'admin'
  // Na página inicial, tocar em "Início" também limpa a busca
  onInicio?: () => void
  // Só quem administra o portal vê o atalho da administração
  showAdmin?: boolean
}

export function BottomMenu({ current, onInicio, showAdmin }: BottomMenuProps) {
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
      {showAdmin && (
        <a
          className="menu-link"
          href={routes.admin}
          aria-current={current === 'admin' ? 'page' : undefined}
          aria-label="Administração"
        >
          <LayoutDashboard size={24} strokeWidth={1.75} aria-hidden="true" />
        </a>
      )}
    </nav>
  )
}
