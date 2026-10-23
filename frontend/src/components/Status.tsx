// Estados de carregamento e erro, iguais em todas as telas

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className="loading" role="status">
      {label}
    </p>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty" role="alert">
      <p>{message}</p>
      <button type="button" className="clear-filters" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  )
}
