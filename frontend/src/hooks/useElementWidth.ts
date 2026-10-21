import { useEffect, useRef, useState } from 'react'

// Largura real do elemento, para os gráficos desenharem em pixels (texto nítido, sem esticar)
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}
