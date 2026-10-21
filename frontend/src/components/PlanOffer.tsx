import { getPlanSettings, planPriceLabel } from '../features/conta/plano'

// Destaque do plano de prestador: período grátis e preço em evidência
export function PlanOffer({ compact }: { compact?: boolean }) {
  const { trialDays } = getPlanSettings()
  return (
    <div className={`plan-offer${compact ? ' plan-offer-compact' : ''}`}>
      <span className="plan-trial">{trialDays} dias grátis</span>
      <p className="plan-offer-price">
        <strong>{planPriceLabel()}</strong> por mês depois
      </p>
      <p className="plan-offer-note">
        Monte seu perfil sem pagar. Os {trialDays} dias começam a contar quando você publicar.
      </p>
    </div>
  )
}
