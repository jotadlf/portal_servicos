// node:crypto no navegador, só com o que a API usa (server/auth.ts e server/app.ts).
// Mesmo algoritmo de senha do Node (scrypt N=16384, r=8, p=1), em JavaScript puro.
import { scryptAsync } from '@noble/hashes/scrypt'
import { sha256 } from '@noble/hashes/sha2'
import { Buffer } from 'buffer'

function base64url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// O Buffer do navegador não conhece "base64url" (usado no token de sessão)
export function randomBytes(size: number) {
  const buffer = Buffer.from(crypto.getRandomValues(new Uint8Array(size)))
  const toString = buffer.toString.bind(buffer)
  buffer.toString = ((encoding?: string, ...rest: number[]) =>
    encoding === 'base64url' ? base64url(buffer) : toString(encoding as BufferEncoding, ...rest)) as typeof buffer.toString
  return buffer
}

export function randomUUID() {
  return crypto.randomUUID()
}

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`Hash não suportado na demonstração: ${algorithm}`)
  let data = ''
  return {
    update(value: string) {
      data += value
      return this
    },
    digest(encoding: 'base64url' | 'hex') {
      const hash = sha256(new TextEncoder().encode(data))
      return encoding === 'base64url' ? base64url(hash) : Buffer.from(hash).toString('hex')
    },
  }
}

export function scrypt(
  password: string,
  salt: Uint8Array,
  keylen: number,
  callback: (error: Error | null, key?: Buffer) => void,
) {
  scryptAsync(password, salt, { N: 16384, r: 8, p: 1, dkLen: keylen }).then(
    (key) => callback(null, Buffer.from(key)),
    (error: Error) => callback(error),
  )
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) throw new RangeError('Input buffers must have the same byte length')
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
