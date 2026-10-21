import { planPriceLabel, TRIAL_DAYS } from '../features/conta/plano'

// Destaque do plano de prestador: período grátis e preço em evidência
export function PlanOffer({ compact }: { compact?: boolean }) {
  return (
    <div className={`plan-offer${compact ? ' plan-offer-compact' : ''}`}>
      <span className="plan-trial">{TRIAL_DAYS} dias grátis</span>
      <p className="plan-offer-price">
        <strong>{planPriceLabel}</strong> por mês depois
      </p>
      <p className="plan-offer-note">
        Monte seu perfil sem pagar. Os {TRIAL_DAYS} dias começam a contar quando você publicar.
      </p>
    </div>
  )
}
