// node:fs, node:path e node:url no navegador: o server/db.ts só lê o schema.sql
import schema from '../../../server/schema.sql?raw'

export function readFileSync(path: string) {
  if (path.endsWith('schema.sql')) return schema
  throw new Error(`Arquivo indisponível na demonstração: ${path}`)
}

export function dirname(path: string) {
  return path.replace(/\/[^/]*$/, '')
}

export function join(...parts: string[]) {
  return parts.join('/')
}

export function fileURLToPath(url: string | URL) {
  return new URL(url).pathname
}
