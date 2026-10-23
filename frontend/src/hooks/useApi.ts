import { useCallback, useEffect, useState } from 'react'
import { ApiError, errorMessage } from '../lib/api'

// status: código HTTP do erro (404 = não existe), para a tela decidir o que mostrar
type State<T> = { data?: T; error?: string; status?: number; loading: boolean }

// Carrega dados da API e acompanha carregando/erro. `key` muda → carrega de novo.
// Resposta que chega depois de trocar de tela (ou de key) é ignorada.
export function useApi<T>(load: () => Promise<T>, key: string = '') {
  const [state, setState] = useState<State<T>>({ loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setState((current) => ({ data: current.data, loading: true }))
    load().then(
      (data) => active && setState({ data, loading: false }),
      (error) =>
        active &&
        setState({
          error: errorMessage(error),
          status: error instanceof ApiError ? error.status : undefined,
          loading: false,
        }),
    )
    return () => {
      active = false
    }
    // `load` é recriada a cada render; o que importa é a key e o pedido de recarregar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const setData = useCallback((data: T) => setState({ data, loading: false }), [])
  return { ...state, reload, setData }
}
