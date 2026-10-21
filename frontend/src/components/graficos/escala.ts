// Escala "redonda" para o eixo: 0 até um teto limpo, em `count` intervalos
export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value)
  return ticks
}

// 1.250 → "1,3 mil" no eixo; abaixo de mil fica o número inteiro
export function compact(value: number) {
  return value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
}

// Barra com o topo arredondado (4px) e a base reta, crescendo da linha de base
export function columnPath(x: number, y: number, width: number, base: number, radius = 4) {
  const height = base - y
  const r = Math.min(radius, height, width / 2)
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${base} Z`
}
