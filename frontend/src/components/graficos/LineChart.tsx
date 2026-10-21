import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { compact, niceTicks } from './escala'

export type Series = {
  name: string
  color: string
  values: number[]
}

type LineChartProps = {
  labels: string[]
  series: Series[]
  format: (value: number) => string
  label: string
  height?: number
}

const MARGIN = { top: 12, right: 112, bottom: 28, left: 40 }

export function LineChart({ labels, series, format, label, height = 220 }: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const plotWidth = Math.max(80, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.values)))
  const top = ticks[ticks.length - 1]
  const step = labels.length > 1 ? plotWidth / (labels.length - 1) : 0
  const x = (index: number) => MARGIN.left + index * step
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight
  // Em telas estreitas, mostra um mês sim, outro não no eixo
  const labelEvery = step < 34 ? 2 : 1
  const last = labels.length - 1

  function pick(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const index = Math.round((event.clientX - box.left) / (step || 1))
    setActive(Math.min(last, Math.max(0, index)))
  }

  function moveWithKeys(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight') setActive((i) => Math.min(last, (i ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? last + 1) - 1))
    else if (event.key === 'Escape') setActive(null)
  }

  const tooltipLeft = active === null ? 0 : x(active)
  const flip = tooltipLeft > width - 150

  return (
    <div className="chart" ref={ref}>
      <ul className="chart-legend">
        {series.map((s) => (
          <li key={s.name}>
            <span className="chart-key chart-key-line" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>

      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. Use as setas para ver cada mês.`}
        tabIndex={0}
        onKeyDown={moveWithKeys}
        onBlur={() => setActive(null)}
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

        {labels.map((text, index) =>
          index % labelEvery === (last % labelEvery) ? (
            <text
              key={text + index}
              className="chart-axis"
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
            >
              {text}
            </text>
          ) : null,
        )}

        {active !== null && (
          <line
            className="chart-crosshair"
            x1={x(active)}
            x2={x(active)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
          />
        )}

        {series.map((s) => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')}
            />
            {/* Ponto e rótulo só no último mês; o resto fica no tooltip e na tabela */}
            <circle
              className="chart-dot"
              cx={x(active ?? last)}
              cy={y(s.values[active ?? last])}
              r={4.5}
              fill={s.color}
            />
            <text
              className="chart-end-label"
              x={x(last) + 10}
              y={y(s.values[last])}
              dy="0.32em"
            >
              {format(s.values[last])} {s.name.toLowerCase()}
            </text>
          </g>
        ))}

        <rect
          className="chart-hit"
          x={MARGIN.left - step / 2}
          y={MARGIN.top}
          width={plotWidth + step}
          height={plotHeight}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {active !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: tooltipLeft,
            top: MARGIN.top + 28,
            transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          }}
          role="status"
        >
          <strong>{labels[active]}</strong>
          {series.map((s) => (
            <span key={s.name}>
              <span className="chart-key" style={{ background: s.color }} />
              {s.name}
              <b>{format(s.values[active])}</b>
            </span>
          ))}
        </div>
      )}

      <ChartTable
        caption={label}
        labels={labels}
        columns={series.map((s) => ({ name: s.name, values: s.values }))}
        format={format}
      />
    </div>
  )
}

type ChartTableProps = {
  caption: string
  labels: string[]
  columns: { name: string; values: number[] }[]
  format: (value: number) => string
}

// Tabela com os mesmos números: acessível e útil para quem quer o valor exato
export function ChartTable({ caption, labels, columns, format }: ChartTableProps) {
  return (
    <details className="chart-table">
      <summary>Ver tabela</summary>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            {columns.map((column) => (
              <th key={column.name} scope="col">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((text, index) => (
            <tr key={text + index}>
              <th scope="row">{text}</th>
              {columns.map((column) => (
                <td key={column.name}>{format(column.values[index])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
