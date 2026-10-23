// Nome de pessoa: letras (com acento), separadas por espaço, apóstrofo ou hífen.
// Aceita "Ana Lima", "D'Ávila" e "Maria-José"; recusa números e símbolos.
export function isValidName(name: string) {
  const value = name.normalize('NFC').trim().replace(/\s+/g, ' ')
  return /^\p{L}+(?:[ '’-]\p{L}+)*$/u.test(value)
}

export const NAME_ERROR = 'Use só letras no nome, sem números ou símbolos.'
