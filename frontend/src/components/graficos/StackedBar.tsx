type Segment = {
  name: string
  value: number
  color: string
}

// Partes de um todo numa barra única, com legenda que já traz número e porcentagem
export function StackedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const percent = (value: number) => (total ? Math.round((value / total) * 100) : 0)

  return (
    <div className="stacked">
      <div className="stacked-bar" role="img" aria-label={label}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.name}
              className="stacked-segment"
              style={{ flexGrow: segment.value, background: segment.color }}
              title={`${segment.name}: ${segment.value} (${percent(segment.value)}%)`}
            />
          ))}
      </div>
      <ul className="stacked-legend">
        {segments.map((segment) => (
          <li key={segment.name}>
            <span className="chart-key" style={{ background: segment.color }} />
            <span>{segment.name}</span>
            <b>{segment.value}</b>
            <small>{percent(segment.value)}%</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
