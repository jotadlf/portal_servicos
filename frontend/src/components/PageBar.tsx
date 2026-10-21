import { ArrowLeft } from 'lucide-react'
import { routes } from '../hooks/useHashRoute'

export function PageBar({ title }: { title: string }) {
  return (
    <header className="page-bar">
      <a className="icon-button" href={routes.inicio} aria-label="Voltar para o início">
        <ArrowLeft size={20} aria-hidden="true" />
      </a>
      <span className="page-bar-title">{title}</span>
    </header>
  )
}
