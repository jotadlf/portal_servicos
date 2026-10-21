import { useState, type KeyboardEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { ChartTable } from './LineChart'
import { columnPath, compact, niceTicks } from './escala'

type ColumnChartProps = {
  labels: string[]
  values: number[]
  color: string
  // Nome da série, para tooltip e tabela (com uma série só não há legenda)
  name: string
  format: (value: number) => string
  label: string
  height?: number
}

const MARGIN = { top: 26, right: 8, bottom: 28, left: 44 }

export function ColumnChart({
  labels,
  values,
  color,
  name,
  format,
  label,
  height = 220,
}: ColumnChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const plotWidth = Math.max(80, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const base = MARGIN.top + plotHeight
  const ticks = niceTicks(Math.max(...values))
  const top = ticks[ticks.length - 1]
  const band = plotWidth / values.length
  const barWidth = Math.min(24, band * 0.6)
  const x = (index: number) => MARGIN.left + index * band + (band - barWidth) / 2
  const y = (value: number) => base - (value / top) * plotHeight
  const labelEvery = band < 34 ? 2 : 1
  const last = values.length - 1
  // O mês atual leva o valor no topo; o destaque acompanha o mês sob o dedo/mouse
  const shown = active ?? last

  function moveWithKeys(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight') setActive((i) => Math.min(last, (i ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? last + 1) - 1))
    else if (event.key === 'Escape') setActive(null)
  }

  const tooltipLeft = active === null ? 0 : x(active) + barWidth / 2
  const flip = tooltipLeft > width - 150

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. Use as setas para ver cada mês.`}
        tabIndex={0}
        onKeyDown={moveWithKeys}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="chart-grid"
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="chart-axis" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
              {compact(tick)}
            </text>
          </g>
        ))}

        {values.map((value, index) => (
          <g key={labels[index] + index}>
            <path
              d={columnPath(x(index), y(value), barWidth, base)}
              fill={color}
              opacity={active === null || active === index ? 1 : 0.45}
            />
            {index % labelEvery === last % labelEvery && (
              <text
                className="chart-axis"
                x={x(index) + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
              >
                {labels[index]}
              </text>
            )}
            {/* Área de toque da coluna inteira, maior que a barra */}
            <rect
              className="chart-hit"
              x={MARGIN.left + index * band}
              y={MARGIN.top}
              width={band}
              height={plotHeight}
              onPointerEnter={() => setActive(index)}
              onPointerDown={() => setActive(index)}
            />
          </g>
        ))}

        <text
          className="chart-value"
          x={x(shown) + barWidth / 2}
          y={y(values[shown]) - 8}
          textAnchor={shown === last ? 'end' : 'middle'}
          dx={shown === last ? barWidth / 2 : 0}
        >
          {format(values[shown])}
        </text>
      </svg>

      {active !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: tooltipLeft,
            top: MARGIN.top + 20,
            transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          }}
          role="status"
        >
          <strong>{labels[active]}</strong>
          <span>
            <span className="chart-key" style={{ background: color }} />
            {name}
            <b>{format(values[active])}</b>
          </span>
        </div>
      )}

      <ChartTable
        caption={label}
        labels={labels}
        columns={[{ name, values }]}
        format={format}
      />
    </div>
  )
}
