// ui/src/components/benchmark/BenchmarkTable.tsx
// Feature matrix – ClickHouse dark + electric yellow design system.

const SYSTEMS = ['PCCM', 'Genesys', 'Zep/Graphiti', 'Mem0', 'Honcho'] as const

const FEATURES = [
  { label: 'Temporal Causality',         values: [true, false, true, false, false] },
  { label: 'Lock-free Concurrent Writes', values: [true, false, false, false, false] },
  { label: 'Sub-10ms Retrieval',         values: [true, false, false, true, false] },
  { label: 'Biological Scoring',         values: [true, false, false, false, false] },
  { label: 'KV Prefetch',               values: [false, false, false, false, false] },
] as const

export default function BenchmarkTable() {
  return (
    <div
      id="benchmark-table-container"
      className="rounded-lg overflow-x-auto"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
            <th
              id="benchmark-th-feature"
              className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider w-48"
              style={{ color: '#888888' }}
            >
              Feature
            </th>
            {SYSTEMS.map((s, i) => (
              <th
                key={s}
                id={`benchmark-th-${s.toLowerCase().replace(/\//g, '-')}`}
                className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider"
                style={{ color: i === 0 ? '#faff69' : '#888888' }}
              >
                {s}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {FEATURES.map(f => (
            <tr
              key={f.label}
              id={`benchmark-row-${f.label.toLowerCase().replace(/\s+/g, '-')}`}
              className="transition-colors cursor-default"
              style={{ borderBottom: '1px solid #2a2a2a' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#242424')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
            >
              <td className="py-3 px-4" style={{ color: '#ffffff' }}>
                {f.label}
              </td>

              {f.values.map((v, i) => (
                <td
                  key={i}
                  className="text-center py-3 px-4"
                  style={{
                    backgroundColor: i === 0 ? '#1a1a0a' : undefined,
                  }}
                >
                  {v ? (
                    <span className="font-bold" style={{ color: '#22c55e' }}>
                      ✓
                    </span>
                  ) : (
                    <span style={{ color: '#5a5a5a' }}>·</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
