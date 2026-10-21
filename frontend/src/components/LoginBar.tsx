import { Lock } from 'lucide-react'

type LoginBarProps = {
  id?: string
  message: string
  onLogin: () => void
}

export function LoginBar({ id, message, onLogin }: LoginBarProps) {
  return (
    <div className="login-bar">
      <Lock size={18} aria-hidden="true" />
      <p id={id}>{message}</p>
      <button type="button" className="login-button" onClick={onLogin}>
        Entrar
      </button>
    </div>
  )
}

// Valor falso desfocado: o preço real não vai para a página sem login
export function BlurredPrice() {
  return (
    <>
      <span className="price-blur" aria-hidden="true">
        R$ 000
      </span>
      <span className="visually-hidden">preço visível após entrar</span>
    </>
  )
}
