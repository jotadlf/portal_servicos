// Canal do titular: pedidos sobre os próprios dados (LGPD art. 18), respondidos em até 15 dias.
// Pelo app só com login, para saber de quem são os dados; sem conta, o e-mail.
import { useRef, useState, type FormEvent } from 'react'
import { BottomMenu } from '../components/BottomMenu'
import { LoginBar } from '../components/LoginBar'
import { PageBar } from '../components/PageBar'
import { LoadError, Loading } from '../components/Status'
import {
  fetchMyDataRequests,
  formatRequestDate,
  MAX_MESSAGE,
  RESPONSE_DAYS,
  sendDataRequest,
  subjectLabel,
  SUBJECTS,
  type DataRequest,
  type Subject,
} from '../features/conta/pedidos'
import type { Account } from '../features/conta/usuario'
import { useApi } from '../hooks/useApi'
import { routes } from '../hooks/useHashRoute'
import { ApiError, errorMessage } from '../lib/api'
import { CONTROLLER } from '../lib/controlador'

type ContatoProps = {
  account?: Account
  onLogin: () => void
}

export function Contato({ account, onLogin }: ContatoProps) {
  return (
    <div className="app">
      <PageBar title="Contato" />
      <main className="page">
        <header className="page-section">
          <h1 className="page-title">Seus dados e privacidade</h1>
          <p className="section-note">
            Peça para ver, corrigir ou apagar os seus dados, ou tire dúvidas sobre como eles são usados.
            Respondemos por e-mail em até {RESPONSE_DAYS} dias. Veja também a{' '}
            <a href={routes.privacidade}>política de privacidade</a>.
          </p>
        </header>

        {account ? (
          <Pedidos key={account.id} account={account} />
        ) : (
          <div className="page-section">
            <LoginBar message="Entre para enviar um pedido sobre a sua conta." onLogin={onLogin} />
          </div>
        )}

        <p className="notice">
          Sem acesso à conta? Escreva para <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>{' '}
          com o e-mail usado no cadastro.
        </p>
      </main>

      <BottomMenu current="conta" showAdmin={account?.isAdmin} />
    </div>
  )
}

function Pedidos({ account }: { account: Account }) {
  const requests = useApi(fetchMyDataRequests, account.id)

  return (
    <>
      <PedidoForm
        email={account.email}
        onSent={(sent) => requests.setData([sent, ...(requests.data ?? [])])}
      />
      {requests.loading && !requests.data && <Loading />}
      {!requests.loading && !requests.data && (
        <LoadError message={requests.error ?? ''} onRetry={requests.reload} />
      )}
      {requests.data && requests.data.length > 0 && <MeusPedidos requests={requests.data} />}
    </>
  )
}

function PedidoForm({ email, onSent }: { email: string; onSent: (request: DataRequest) => void }) {
  const [subject, setSubject] = useState<Subject | ''>('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({})
  const [formError, setFormError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const subjectRef = useRef<HTMLSelectElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const found = {
      subject: subject ? undefined : 'Escolha o assunto.',
      message: message.trim() ? undefined : 'Escreva o seu pedido.',
    }
    setErrors(found)
    setFormError('')
    setSent(false)
    if (found.subject) return subjectRef.current?.focus()
    if (found.message) return messageRef.current?.focus()

    setBusy(true)
    try {
      onSent(await sendDataRequest(subject as Subject, message))
      setSubject('')
      setMessage('')
      setSent(true)
    } catch (failure) {
      const fields = failure instanceof ApiError ? failure.fields : {}
      if (fields.subject || fields.message) {
        setErrors({ subject: fields.subject, message: fields.message })
        if (fields.subject) subjectRef.current?.focus()
        else messageRef.current?.focus()
      } else {
        setFormError(errorMessage(failure))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="page-section form" onSubmit={handleSubmit} noValidate>
      <h2>Novo pedido</h2>

      <label className="field">
        <span>Assunto</span>
        <select
          ref={subjectRef}
          name="subject"
          value={subject}
          aria-invalid={errors.subject ? true : undefined}
          aria-describedby={errors.subject ? 'subject-erro' : undefined}
          onChange={(e) => {
            setSubject(e.target.value as Subject)
            setErrors((current) => ({ ...current, subject: undefined }))
          }}
        >
          <option value="" disabled>
            Escolha
          </option>
          {SUBJECTS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {errors.subject && (
          <small id="subject-erro" className="form-error">
            {errors.subject}
          </small>
        )}
      </label>

      <label className="field">
        <span>Mensagem</span>
        <textarea
          ref={messageRef}
          name="message"
          rows={5}
          maxLength={MAX_MESSAGE}
          value={message}
          placeholder={
            subject === 'correcao' ? 'Diga qual dado está errado e qual é o certo.' : 'Conte o que você precisa.'
          }
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'message-erro' : 'message-ajuda'}
          onChange={(e) => {
            setMessage(e.target.value)
            setErrors((current) => ({ ...current, message: undefined }))
          }}
        />
        {errors.message ? (
          <small id="message-erro" className="form-error">
            {errors.message}
          </small>
        ) : (
          <small id="message-ajuda" className="field-help">
            A resposta vai para {email}.
          </small>
        )}
      </label>

      <div aria-live="polite">
        {formError && <p className="form-error">{formError}</p>}
        {sent && <p className="form-ready">Pedido enviado. Você recebe a resposta por e-mail.</p>}
      </div>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </div>
    </form>
  )
}

function MeusPedidos({ requests }: { requests: DataRequest[] }) {
  return (
    <section className="page-section" aria-labelledby="meus-pedidos">
      <h2 id="meus-pedidos">Seus pedidos</h2>
      <ul className="review-list">
        {requests.map((request) => (
          <li key={request.id} className="review">
            <div className="review-head">
              <strong>{subjectLabel(request.subject)}</strong>
              <span className="review-date">{formatRequestDate(request.createdAt)}</span>
            </div>
            <p>{request.message}</p>
            <p className="contact-task">
              {request.answeredAt
                ? `Respondido em ${formatRequestDate(request.answeredAt)}`
                : 'Aguardando resposta'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
