// Formato nome@dominio.com, sem espaços e com terminação de pelo menos 2 letras.
// Só confere a forma: quem garante que o e-mail existe é o link de confirmação do cadastro.
export function isValidEmail(email: string) {
  const value = email.trim()
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(value)
}
