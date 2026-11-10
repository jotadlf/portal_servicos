// Data de nascimento de quem oferece serviços. Mesmas regras de interno.nascimento no banco.

export const MIN_AGE = 18
const MAX_AGE = 120
const INVALID = 'Informe uma data válida, como 25/03/1990.'

// Máscara para digitação: DD/MM/AAAA
export function formatBirthDate(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

// DD/MM/AAAA de uma data que existe vira AAAA-MM-DD (o que o banco recebe); senão, null
export function toIsoDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return null
  }
  return `${year}-${month}-${day}`
}

// Mesma data, N anos antes (29/02 vira 28/02 quando o ano não é bissexto, como no banco)
function yearsBefore(today: Date, years: number) {
  const date = new Date(today.getFullYear() - years, today.getMonth(), today.getDate())
  if (date.getMonth() !== today.getMonth()) date.setDate(0)
  return date
}

function isoOf(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function birthDateError(value: string, today = new Date()) {
  if (!value.trim()) return 'Informe sua data de nascimento.'
  const iso = toIsoDate(value)
  if (!iso) return INVALID
  if (iso > isoOf(today) || iso <= isoOf(yearsBefore(today, MAX_AGE))) return INVALID
  if (iso > isoOf(yearsBefore(today, MIN_AGE))) return `É preciso ter ${MIN_AGE} anos ou mais para oferecer serviços.`
  return undefined
}
