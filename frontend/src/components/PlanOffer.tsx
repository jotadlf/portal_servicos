import { planPriceLabel } from '../features/conta/plano'
import { fetchPlanSettings } from '../features/conta/plano-api'
import { useApi } from '../hooks/useApi'

// Destaque do plano de prestador: período grátis e preço em evidência
export function PlanOffer({ compact }: { compact?: boolean }) {
  const { data: settings } = useApi(fetchPlanSettings)
  if (!settings) return null
  const { trialDays } = settings
  return (
    <div className={`plan-offer${compact ? ' plan-offer-compact' : ''}`}>
      <span className="plan-trial">{trialDays} dias grátis</span>
      <p className="plan-offer-price">
        <strong>{planPriceLabel(settings)}</strong> por mês depois
      </p>
      <p className="plan-offer-note">
        Monte seu perfil sem pagar. Os {trialDays} dias começam a contar quando você publicar.
      </p>
    </div>
  )
}
