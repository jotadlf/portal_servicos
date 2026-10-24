// node:zlib no navegador: o que server/seed-fotos.ts usa para montar os PNG dos avatares
import { Buffer } from 'buffer'
import { zlibSync } from 'fflate'

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// Mesmo formato do deflateSync do Node (com o cabeçalho zlib), que é o que o PNG espera
export function deflateSync(data: Uint8Array) {
  return Buffer.from(zlibSync(data))
}
