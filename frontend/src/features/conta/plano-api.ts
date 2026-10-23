import { api } from '../../lib/api'
import type { PlanSettings } from './plano'

export function fetchPlanSettings() {
  return api<PlanSettings>('GET', '/api/plano')
}

// Só a administração consegue; o servidor confere
export function savePlanSettings(settings: PlanSettings) {
  return api<PlanSettings>('PUT', '/api/plano', settings)
}
