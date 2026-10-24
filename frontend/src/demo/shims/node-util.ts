// node:util no navegador: só o promisify usado com o scrypt
type Callback = (error: Error | null, value?: unknown) => void

export function promisify(fn: (...args: never[]) => void) {
  return (...args: unknown[]) =>
    new Promise((resolve, reject) => {
      const callback: Callback = (error, value) => (error ? reject(error) : resolve(value))
      ;(fn as (...a: unknown[]) => void)(...args, callback)
    })
}
