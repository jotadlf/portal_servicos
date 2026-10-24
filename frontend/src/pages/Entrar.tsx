import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { BriefcaseBusiness, Eye as EyeOpen, EyeOff } from 'lucide-react'
import { PageBar } from '../components/PageBar'
import { planPriceLabel } from '../features/conta/plano'
import { fetchPlanSettings } from '../features/conta/plano-api'
import { createAccount, signIn, type Account } from '../features/conta/usuario'
import { useApi } from '../hooks/useApi'
import { routes } from '../hooks/useHashRoute'
import { ApiError, errorMessage } from '../lib/api'
import { formatCpf, isValidCpf } from '../lib/cpf'
import { isValidEmail } from '../lib/email'
import { firstName } from '../lib/format'
import { isValidName, NAME_ERROR } from '../lib/nome'
import logo from '../assets/zumzum-icone.svg'

type EntrarProps = {
  mode: 'login' | 'cadastro'
  // next: página para onde ir em vez de voltar à anterior
  onSignedIn: (account: Account, next?: string) => void
  // Página para onde vai quem prefere continuar sem conta
  guestHref?: string
}

const MIN_PASSWORD = 6

export function Entrar({ mode, onSignedIn, guestHref = routes.inicio }: EntrarProps) {
  const isSignup = mode === 'cadastro'

  return (
    <div className="app">
      <PageBar title={isSignup ? 'Criar conta' : 'Entrar'} />
      <main className="page auth">
        <div className="auth-head">
          <img src={logo} alt="" width={40} height={40} />
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

        {/* Visitante vê os serviços, mas sem preço, foto e WhatsApp dos prestadores */}
        <p className="auth-switch">
          <a href={guestHref}>Entrar como visitante</a>
        </p>
      </main>
    </div>
  )
}

// Quem já está na conta e chega aqui (pelo voltar do navegador, por exemplo)
export function AlreadySignedIn({ name }: { name: string }) {
  return (
    <div className="app">
      <PageBar title="Entrar" />
      <main className="page auth">
        <div className="empty">
          <p>Você já está na sua conta, {firstName(name)}.</p>
          <a className="clear-filters" href={routes.inicio}>
            Ir para o início
          </a>
        </div>
      </main>
    </div>
  )
}

// Só Google: entrar com Apple exige o Apple Developer Program (pago) e não é
// obrigatório para PWA, só para app publicado na App Store.
function SocialButtons() {
  const [unavailable, setUnavailable] = useState(false)

  // TODO: supabase.auth.signInWithOAuth({ provider: 'google' }) quando o
  // Supabase estiver configurado com as credenciais do Google.
  return (
    <div className="social">
      <button type="button" className="social-button" onClick={() => setUnavailable(true)}>
        <GoogleIcon />
        Continuar com Google
      </button>
      <div aria-live="polite">
        {unavailable && (
          <p className="field-help">
            Entrar com Google ainda não está disponível. Use e-mail e senha por enquanto.
          </p>
        )}
      </div>
    </div>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  // Mensagem do problema; com ela o campo ganha o contorno vermelho
  error?: string
  help?: string
}

function Field({ label, name, error, help, ...input }: FieldProps) {
  // Campo de senha ganha o botão do olho para mostrar o que foi digitado
  const isPassword = input.type === 'password'
  const [visible, setVisible] = useState(false)
  const noteId = `${name}-nota`
  const note = error || help
  const control = (
    <input
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? noteId : undefined}
      {...input}
      type={isPassword && visible ? 'text' : input.type}
      onBlur={(event) => {
        // Tocar no olho não conta como sair do campo: não acusa erro antes da hora
        if (event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) return
        input.onBlur?.(event)
      }}
    />
  )
  const Eye = visible ? EyeOff : EyeOpen

  return (
    <label className="field">
      <span>{label}</span>
      {isPassword ? (
        <span className="password-input">
          {control}
          <button
            type="button"
            className="password-toggle"
            aria-label="Mostrar senha"
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            <Eye size={18} aria-hidden="true" />
          </button>
        </span>
      ) : (
        control
      )}
      {note && (
        <small id={noteId} className={error ? 'form-error' : 'field-help'}>
          {note}
        </small>
      )}
    </label>
  )
}

type Errors = Record<string, string | undefined>

// Os problemas de cada campo só aparecem depois que a pessoa sai dele ou tenta enviar,
// para não acusar erro enquanto ela ainda está digitando pela primeira vez.
function useFieldErrors(errors: Errors) {
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const errorOf = (name: string) => (submitted || touched.has(name) ? errors[name] : undefined)
  const touch = (name: string) => setTouched((current) => new Set(current).add(name))

  // Ao enviar: mostra todos os problemas e leva o foco ao primeiro. Devolve se está tudo certo.
  function validate(form: HTMLFormElement) {
    setSubmitted(true)
    const first = Object.keys(errors).find((name) => errors[name])
    if (!first) return true
    const input = form.elements.namedItem(first)
    if (input instanceof HTMLElement) input.focus()
    return false
  }

  return { errorOf, touch, validate }
}

function emailError(email: string) {
  if (!email.trim()) return 'Informe seu e-mail.'
  if (!isValidEmail(email)) return 'Informe um e-mail válido, como nome@exemplo.com.'
}

function LoginForm({ onSignedIn }: Pick<EntrarProps, 'onSignedIn'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fields = useFieldErrors({
    email: emailError(email),
    password: password ? undefined : 'Informe sua senha.',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !fields.validate(event.currentTarget)) return
    setBusy(true)
    try {
      onSignedIn(await signIn(email, password))
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <form className="page-section form" onSubmit={handleSubmit} noValidate>
      <Field
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        error={fields.errorOf('email')}
        onBlur={() => fields.touch('email')}
        onChange={(e) => {
          setEmail(e.target.value)
          setError('')
        }}
      />

      <Field
        label="Senha"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        error={fields.errorOf('password')}
        onBlur={() => fields.touch('password')}
        onChange={(e) => {
          setPassword(e.target.value)
          setError('')
        }}
      />

      <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function CadastroForm({ onSignedIn }: Pick<EntrarProps, 'onSignedIn'>) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [asProvider, setAsProvider] = useState(false)
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState('')
  // Problemas que só o servidor sabe (e-mail ou CPF já usados), por campo
  const [serverFields, setServerFields] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const cpfDigits = cpf.replace(/\D/g, '')

  const fields = useFieldErrors({
    name: !name.trim() ? 'Informe seu nome.' : isValidName(name) ? undefined : NAME_ERROR,
    email: emailError(email) ?? serverFields.email,
    password: !password
      ? 'Crie uma senha.'
      : password.length < MIN_PASSWORD
        ? `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
        : undefined,
    passwordConfirm: !passwordConfirm
      ? 'Repita a senha.'
      : passwordConfirm !== password
        ? 'As senhas não são iguais.'
        : undefined,
    // CPF só conta para quem vai oferecer serviços
    cpf: !asProvider
      ? undefined
      : !cpfDigits
        ? 'Informe seu CPF.'
        : isValidCpf(cpfDigits)
          ? serverFields.cpf
          : 'Informe um CPF válido.',
  })

  // Mexer num campo apaga o aviso do servidor sobre ele
  function clearServer(field: string) {
    setServerFields((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (busy || !fields.validate(form)) return
    setBusy(true)
    try {
      const account = await createAccount({
        name,
        email,
        password,
        asProvider,
        cpf: asProvider ? cpfDigits : undefined,
      })
      // Quem vai oferecer serviços já cai na página para cadastrar o primeiro
      onSignedIn(account, asProvider ? routes.servicos : undefined)
    } catch (failure) {
      setBusy(false)
      const byField = failure instanceof ApiError ? failure.fields : {}
      const first = Object.keys(byField)[0]
      if (first) {
        setServerFields(byField)
        const input = form.elements.namedItem(first)
        if (input instanceof HTMLElement) input.focus()
      } else {
        setError(errorMessage(failure))
      }
    }
  }

  return (
    <form
      className="page-section form"
      onSubmit={handleSubmit}
      onChange={() => setError('')}
      noValidate
    >
      <Field
        label="Nome"
        name="name"
        required
        maxLength={60}
        autoComplete="name"
        value={name}
        error={fields.errorOf('name')}
        onBlur={() => fields.touch('name')}
        onChange={(e) => setName(e.target.value)}
      />

      <Field
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        error={fields.errorOf('email')}
        onBlur={() => fields.touch('email')}
        onChange={(e) => {
          setEmail(e.target.value)
          clearServer('email')
        }}
      />

      <Field
        label="Senha"
        name="password"
        type="password"
        required
        minLength={MIN_PASSWORD}
        autoComplete="new-password"
        value={password}
        help={`Pelo menos ${MIN_PASSWORD} caracteres.`}
        error={fields.errorOf('password')}
        onBlur={() => fields.touch('password')}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Field
        label="Confirmar senha"
        name="passwordConfirm"
        type="password"
        required
        autoComplete="new-password"
        value={passwordConfirm}
        error={fields.errorOf('passwordConfirm')}
        onBlur={() => fields.touch('passwordConfirm')}
        onChange={(e) => setPasswordConfirm(e.target.value)}
      />

      <label className="provider-option">
        <span className="provider-icon" aria-hidden="true">
          <BriefcaseBusiness size={20} />
        </span>
        <span className="provider-text">
          <strong>Também quero oferecer serviços</strong>
          <small>Receba contatos de clientes da sua região.</small>
        </span>
        {/* Caixa de marcar com cara de chave liga/desliga */}
        <input
          type="checkbox"
          className="switch"
          checked={asProvider}
          onChange={(e) => setAsProvider(e.target.checked)}
        />
        {/* O preço só aparece para quem ligou a opção, alinhado com o texto */}
        {asProvider && <ProviderPrice />}
      </label>

      {asProvider && (
        <Field
          label="CPF"
          name="cpf"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          help="Pedimos o CPF de quem oferece serviços. Ele não aparece no seu perfil."
          error={fields.errorOf('cpf')}
          onBlur={() => fields.touch('cpf')}
          onChange={(e) => {
            setCpf(formatCpf(e.target.value))
            clearServer('cpf')
          }}
        />
      )}

      <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Criando conta…' : asProvider ? 'Criar conta de prestador' : 'Criar conta'}
      </button>
    </form>
  )
}

// Destaque do período gratuito e do valor cobrado depois dele
function ProviderPrice() {
  const { data: settings } = useApi(fetchPlanSettings)
  if (!settings) return null
  const { trialDays } = settings
  const price = <strong>{planPriceLabel(settings)} por mês</strong>

  // Sem período grátis configurado na administração, só o valor
  if (trialDays === 0) {
    return <span className="signup-price-after">Oferecer serviços custa {price}.</span>
  }

  const days = trialDays === 1 ? '1 dia' : `${trialDays} dias`
  return (
    <span className="signup-price">
      <span className="signup-free">Gratuito por {days}</span>
      <small className="signup-price-after">
        Depois de {days}, será cobrado {price}.
      </small>
    </span>
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
