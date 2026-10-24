// node:sqlite no navegador: o mesmo SQLite, compilado para WebAssembly (sql.js), com a
// interface do DatabaseSync que a API usa (exec, prepare → get/all/run, close).
// O banco fica na memória da página e é guardado no IndexedDB deste aparelho.
import initSqlJs, { type BindParams, type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const STORE = 'portal-demo'
const KEY = 'banco'

function openStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(STORE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadSaved() {
  try {
    const store = await openStore()
    return await new Promise<Uint8Array | undefined>((resolve, reject) => {
      const request = store.transaction(STORE).objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve(request.result as Uint8Array | undefined)
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Sem IndexedDB (modo privado restrito): começa do zero a cada visita
    return undefined
  }
}

async function save(bytes: Uint8Array) {
  try {
    const store = await openStore()
    store.transaction(STORE, 'readwrite').objectStore(STORE).put(bytes, KEY)
  } catch {
    // Sem IndexedDB: os dados valem até fechar a página
  }
}

const SQL = await initSqlJs({ locateFile: () => wasmUrl })
const saved = await loadSaved()

type Value = string | number | null | Uint8Array

// undefined vira null; o resto o sql.js já entende (o Buffer é um Uint8Array)
const params = (args: unknown[]) => args.map((arg) => (arg === undefined ? null : arg)) as BindParams

class StatementSync {
  private db: Database
  private sql: string
  constructor(db: Database, sql: string) {
    this.db = db
    this.sql = sql
  }

  get(...args: unknown[]) {
    const statement = this.db.prepare(this.sql)
    try {
      statement.bind(params(args))
      return statement.step() ? (statement.getAsObject() as Record<string, Value>) : undefined
    } finally {
      statement.free()
    }
  }

  all(...args: unknown[]) {
    const statement = this.db.prepare(this.sql)
    try {
      statement.bind(params(args))
      const rows: Record<string, Value>[] = []
      while (statement.step()) rows.push(statement.getAsObject() as Record<string, Value>)
      return rows
    } finally {
      statement.free()
    }
  }

  run(...args: unknown[]) {
    this.db.run(this.sql, params(args))
    const changes = this.db.getRowsModified()
    const lastInsertRowid = (this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0) as number
    return { changes, lastInsertRowid }
  }
}

export class DatabaseSync {
  private db: Database
  // ':memory:' é sempre um banco novo; qualquer outro nome retoma o guardado no aparelho
  constructor(path: string) {
    this.db = path !== ':memory:' && saved ? new SQL.Database(saved) : new SQL.Database()
  }

  exec(sql: string) {
    this.db.exec(sql)
  }

  prepare(sql: string) {
    return new StatementSync(this.db, sql)
  }

  close() {
    this.db.close()
  }

  // Guarda o banco no aparelho. O export do sql.js reabre o banco e zera os PRAGMAs,
  // então as chaves estrangeiras são religadas em seguida.
  persist() {
    const bytes = this.db.export()
    this.db.exec('PRAGMA foreign_keys = ON')
    return save(bytes)
  }
}
