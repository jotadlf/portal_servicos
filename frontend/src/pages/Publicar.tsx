import { useState, type FormEvent } from 'react'
import { Check, CreditCard, QrCode } from 'lucide-react'
import { LoginBar } from '../components/LoginBar'
import { PageBar } from '../components/PageBar'
import {
  findPlan,
  formatMoney,
  planSavings,
  trialEndDate,
  getPlans,
  getPlanSettings,
  type PlanId,
} from '../features/conta/plano'
import { getAccountProfessional, type Account } from '../features/conta/usuario'
import { updateProfessional } from '../features/profissionais/dados-exemplo'
import { routes } from '../hooks/useHashRoute'
import { formatDate } from '../lib/format'

type PublicarProps = {
  account?: Account
  onLogin: () => void
}

const methods = [
  { id: 'pix', label: 'Pix', note: 'Cobrança automática autorizada no app do seu banco', icon: QrCode },
  { id: 'cartao', label: 'Cartão de crédito', note: 'Cobrança automática no cartão', icon: CreditCard },
] as const

type MethodId = (typeof methods)[number]['id']

const benefits = [
  'Seu perfil aparece nas buscas da sua região',
  'Clientes falam com você direto pelo WhatsApp',
  'Serviços de quantas profissões quiser',
  'Cancele quando quiser, sem multa',
]

export function Publicar({ account, onLogin }: PublicarProps) {
  const pro = account ? getAccountProfessional(account) : undefined

  return (
    <div className="app">
      <PageBar title="Publicar perfil" />
      <main className="page">
        {!account && <LoginBar message="Entre para publicar seu perfil." onLogin={onLogin} />}

        {account && !pro && (
          <div className="empty">
            <p>Você ainda não oferece serviços.</p>
            <a className="clear-filters" href={routes.servicos}>
              Ir para Serviços
            </a>
          </div>
        )}

        {pro?.status === 'publicado' && (
          <div className="empty">
            <p>Seu perfil já está publicado.</p>
            <a className="clear-filters" href={routes.servicos}>
              Voltar para Serviços
            </a>
          </div>
        )}

        {pro?.status === 'rascunho' && <Checkout professionalId={pro.id} />}
      </main>
    </div>
  )
}

function Checkout({ professionalId }: { professionalId: string }) {
  const { trialDays, pixEnabled, cardEnabled } = getPlanSettings()
  const plans = getPlans()
  // Só as formas de pagamento ligadas na administração
  const enabledMethods = methods.filter(({ id }) => (id === 'pix' ? pixEnabled : cardEnabled))
  const [planId, setPlanId] = useState<PlanId>('mensal')
  const [method, setMethod] = useState<MethodId | undefined>(enabledMethods[0]?.id)
  const plan = findPlan(planId)
  const firstCharge = trialEndDate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // TODO: criar a assinatura no gateway de pagamento (Mercado Pago, Stripe...).
    // Os dados do cartão são digitados na página do gateway, nunca no nosso app.
    updateProfessional(professionalId, {
      status: 'publicado',
      trialEndsAt: firstCharge,
      plan: planId,
    })
    window.location.assign(routes.servicos)
  }

  return (
    <form className="checkout" onSubmit={handleSubmit}>
      <section className="plan-card" aria-labelledby="plano-titulo">
        <h1 id="plano-titulo" className="page-title">
          Publique seu perfil
        </h1>
        <p className="plan-trial">{trialDays} dias grátis em qualquer plano</p>
        <ul className="plan-benefits">
          {benefits.map((benefit) => (
            <li key={benefit}>
              <Check size={16} aria-hidden="true" />
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      <fieldset className="page-section choice-group">
        <legend>Plano</legend>
        {plans.map((option) => {
          const savings = planSavings(option)
          return (
            <label
              key={option.id}
              className={`choice plan-choice${planId === option.id ? ' is-active' : ''}`}
            >
              <input
                type="radio"
                name="plano"
                value={option.id}
                checked={planId === option.id}
                onChange={() => setPlanId(option.id)}
              />
              <span className="choice-text">
                <strong>{option.label}</strong>
                <small>
                  {option.months > 1
                    ? `Equivale a ${formatMoney(option.price / option.months)} por mês`
                    : 'Cancele quando quiser'}
                </small>
              </span>
              <span className="plan-choice-price">
                {savings.percent > 0 && (
                  <span className="plan-savings">Economize {savings.percent}%</span>
                )}
                <strong>{formatMoney(option.price)}</strong>
                <small>{option.period}</small>
              </span>
            </label>
          )
        })}
      </fieldset>

      <fieldset className="page-section choice-group">
        <legend>Forma de pagamento</legend>
        {enabledMethods.length === 0 && (
          <p className="form-error">
            Nenhuma forma de pagamento está disponível no momento. Tente de novo mais tarde.
          </p>
        )}
        {enabledMethods.map(({ id, label, note, icon: Icon }) => (
          <label key={id} className={`choice${method === id ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="forma"
              value={id}
              checked={method === id}
              onChange={() => setMethod(id)}
            />
            <Icon size={20} aria-hidden="true" />
            <span className="choice-text">
              <strong>{label}</strong>
              <small>{note}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <section className="page-section charge-summary" aria-label="Resumo da cobrança">
        <p>
          <span>Hoje</span>
          <strong>R$ 0,00</strong>
        </p>
        <p>
          <span>Em {formatDate(firstCharge)}</span>
          <strong>{formatMoney(plan.price)}</strong>
        </p>
        <small className="field-help">
          Se cancelar antes de {formatDate(firstCharge)}, você não paga nada. Depois, a cobrança
          de {formatMoney(plan.price)} se repete {plan.every} no{' '}
          {method === 'pix' ? 'Pix' : 'cartão'}, até você cancelar.
        </small>
      </section>

      <button type="submit" className="primary" disabled={!method}>
        Começar {trialDays} dias grátis e publicar
      </button>
    </form>
  )
}
