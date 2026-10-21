import { useState, type FormEvent } from 'react'
import { PageBar } from '../components/PageBar'
import { PlanOffer } from '../components/PlanOffer'
import {
  createAccount,
  isEmailTaken,
  signIn,
  type Account,
} from '../features/conta/usuario'
import { routes } from '../hooks/useHashRoute'
import logo from '../assets/zumzum-icone.svg'

type EntrarProps = {
  mode: 'login' | 'cadastro'
  // next: página para onde ir em vez de voltar à anterior
  onSignedIn: (account: Account, next?: string) => void
}

const MIN_PASSWORD = 6

export function Entrar({ mode, onSignedIn }: EntrarProps) {
  const isSignup = mode === 'cadastro'

  return (
    <div className="app">
      <PageBar title={isSignup ? 'Criar conta' : 'Entrar'} />
      <main className="page auth">
        <div className="auth-head">
          <img src={logo} alt="" width={56} height={56} />
          <h1 className="page-title">{isSignup ? 'Crie sua conta' : 'Entre na sua conta'}</h1>
          <p className="section-note">
            {isSignup
              ? 'Com uma conta você contrata serviços e, se quiser, oferece os seus.'
              : 'Para ver preços e falar com os profissionais pelo WhatsApp.'}
          </p>
        </div>

        <SocialButtons />

        <p className="auth-divider">
          <span>ou com e-mail</span>
        </p>

        {isSignup ? (
          <CadastroForm key="cadastro" onSignedIn={onSignedIn} />
        ) : (
          <LoginForm key="login" onSignedIn={onSignedIn} />
        )}

        <p className="auth-switch">
          {isSignup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
          <a href={isSignup ? routes.entrar : routes.cadastro}>
            {isSignup ? 'Entrar' : 'Criar conta'}
          </a>
        </p>
      </main>
    </div>
  )
}

function SocialButtons() {
  const [unavailable, setUnavailable] = useState('')

  // TODO: supabase.auth.signInWithOAuth({ provider: 'google' | 'apple' }) quando o
  // Supabase estiver configurado com as credenciais do Google e da Apple.
  return (
    <div className="social">
      <button type="button" className="social-button" onClick={() => setUnavailable('Google')}>
        <GoogleIcon />
        Continuar com Google
      </button>
      <button
        type="button"
        className="social-button social-apple"
        onClick={() => setUnavailable('Apple')}
      >
        <AppleIcon />
        Continuar com Apple
      </button>
      <div aria-live="polite">
        {unavailable && (
          <p className="field-help">
            Entrar com {unavailable} ainda não está disponível. Use e-mail e senha por enquanto.
          </p>
        )}
      </div>
    </div>
  )
}

function LoginForm({ onSignedIn }: Pick<EntrarProps, 'onSignedIn'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const account = signIn(email, password)
    if (!account) {
      setError('E-mail ou senha incorretos. Confira e tente de novo.')
      return
    }
    onSignedIn(account)
  }

  return (
    <form className="page-section form" onSubmit={handleSubmit}>
      <label className="field">
        <span>E-mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
        />
      </label>

      <label className="field">
        <span>Senha</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
        />
      </label>

      <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>

      <button type="submit" className="primary">
        Entrar
      </button>
    </form>
  )
}

function CadastroForm({ onSignedIn }: Pick<EntrarProps, 'onSignedIn'>) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [asProvider, setAsProvider] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    if (isEmailTaken(email)) {
      setError('Já existe uma conta com esse e-mail. Entre com ele ou use outro.')
      return
    }

    const account = createAccount({ name, email, password, asProvider })
    // Quem vai oferecer serviços já cai na página para cadastrar o primeiro
    onSignedIn(account, asProvider ? routes.servicos : undefined)
  }

  return (
    <form
      className="page-section form"
      onSubmit={handleSubmit}
      onChange={() => setError('')}
    >
      <label className="field">
        <span>Nome</span>
        <input
          required
          maxLength={60}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span>E-mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Senha</span>
        <input
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          aria-describedby="senha-ajuda"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <small id="senha-ajuda" className="field-help">
          Pelo menos {MIN_PASSWORD} caracteres.
        </small>
      </label>

      <label className="provider-option">
        <input
          type="checkbox"
          checked={asProvider}
          onChange={(e) => setAsProvider(e.target.checked)}
        />
        <span>
          <strong>Também quero oferecer serviços</strong>
          <PlanOffer compact />
        </span>
      </label>

      <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>

      <button type="submit" className="primary">
        {asProvider ? 'Criar conta de prestador' : 'Criar conta'}
      </button>
    </form>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  )
}
