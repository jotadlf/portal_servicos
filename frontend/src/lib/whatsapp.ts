// Telefone guardado só com dígitos: DDD + número (10 ou 11 dígitos)
export function isValidPhone(digits: string) {
  return /^[1-9]\d{9,10}$/.test(digits)
}

// Máscara para exibição: (62) 99999-9999
export function formatPhone(value: string) {
  let d = value.replace(/\D/g, '')
  // Número colado com o código do Brasil (+55 62 99999-8888): o 55 sai
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  d = d.slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function openWhatsapp(digits: string, message: string) {
  const url = `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function contactMessage(professionalFirstName: string, task?: string) {
  const about = task ? ` sobre o serviço "${task}"` : ''
  return `Olá, ${professionalFirstName}! Vi seu perfil no Portal de Serviços e gostaria de conversar${about}.`
}
