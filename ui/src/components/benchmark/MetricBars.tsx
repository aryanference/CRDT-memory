// ui/src/components/benchmark/MetricBars.tsx
// Horizontal bars – ClickHouse dark + electric yellow design system.

interface System { name: string; value: number; unit: string }

interface MetricBarsProps {
  title: string
  systems: System[]
  lowerIsBetter?: boolean
  formatValue?: (v: number) => string
}

export default function MetricBars({ title, systems, lowerIsBetter, formatValue }: MetricBarsProps) {
  const sorted = [...systems].sort((a, b) =>
    lowerIsBetter ? a.value - b.value : b.value - a.value
  )
  const best = sorted[0].value
  const worst = sorted[sorted.length - 1].value
  const range = Math.abs(best - worst) || 1

  const barPct = (v: number) =>
    lowerIsBetter
      ? Math.max(10, (1 - (v - best) / range) * 100)
      : Math.max(10, ((v - worst) / range) * 100)

  const fmt = formatValue ?? ((v: number) => `${v}${systems[0].unit}`)

  return (
    <div
      id="metric-bars-container"
      className="rounded-lg p-5"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <h3
        id="metric-bars-title"
        className="text-sm font-semibold mb-4"
        style={{ color: '#ffffff' }}
      >
        {title}
      </h3>

      <div className="space-y-2.5">
        {sorted.map((sys, i) => {
          const isPCCM = sys.name === 'PCCM'
          const pct = barPct(sys.value)
          const isFirst = i === 0

          return (
            <div
              key={sys.name}
              id={`metric-bar-row-${sys.name.toLowerCase().replace(/\//g, '-')}`}
              className="flex items-center gap-3"
            >
              {/* Label */}
              <span
                className={`text-xs w-24 shrink-0 ${isPCCM ? 'font-bold' : 'font-normal'}`}
                style={{ color: isPCCM ? '#faff69' : '#888888' }}
              >
                {sys.name}
              </span>

              {/* Bar track */}
              <div
                className="flex-1 h-7 rounded-md overflow-hidden relative"
                style={{ backgroundColor: '#242424' }}
              >
                {/* Fill */}
                <div
                  className="h-full rounded-md flex items-center pl-2.5 transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isPCCM ? '#faff69' : '#3a3a3a',
                    minWidth: 36,
                  }}
                >
                  <span
                    className="font-mono text-xs font-medium"
                    style={{ color: isPCCM ? '#0a0a0a' : '#cccccc' }}
                  >
                    {fmt(sys.value)}
                  </span>
                </div>

                {/* Best badge */}
                {isFirst && (
                  <span
                    id={`metric-bar-best-badge-${sys.name.toLowerCase()}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: '#22c55e',
                      backgroundColor: 'rgba(34,197,94,0.12)',
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}
                  >
                    Best
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
