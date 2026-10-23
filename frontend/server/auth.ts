import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>
const KEY_LENGTH = 64

// Senha guardada como "scrypt$sal$hash" (base64). A senha em si nunca vai para o banco.
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

// Hash qualquer para comparar quando o e-mail não existe: a resposta leva o mesmo tempo
// e não entrega quais e-mails têm conta
export const DUMMY_HASH = await hashPassword(randomBytes(12).toString('hex'))

// Token entregue ao navegador; no banco fica só o hash dele
export function newSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

export const SESSION_DAYS = 7
