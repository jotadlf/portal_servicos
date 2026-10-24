import { rpc } from '../../lib/api'
import type { PlanSettings } from './plano'

export function fetchPlanSettings() {
  return rpc<PlanSettings>('plano')
}

// Só a administração consegue; o banco confere
export function savePlanSettings(settings: PlanSettings) {
  return rpc<PlanSettings>('salvar_plano', settings)
}
