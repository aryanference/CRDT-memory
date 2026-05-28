// ui/src/components/graph/EdgeLegend.tsx
// Compact edge-type color legend – ClickHouse dark theme.

import { EDGE_COLORS, type EdgeType } from '@/types/pccm'

const MUTED = '#888888'

const EDGES: { type: EdgeType; label: string }[] = [
  { type: 'causes',                  label: 'Causes' },
  { type: 'enables',                 label: 'Enables' },
  { type: 'prevents',                label: 'Prevents' },
  { type: 'temporal_co_occurrence',  label: 'Temporal' },
]

export default function EdgeLegend() {
  return (
    <div
      id="edge-legend"
      style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
    >
      {EDGES.map(({ type, label }) => (
        <div
          key={type}
          id={`edge-legend-${type}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {/* Colored dash */}
          <div
            style={{
              width: 20,
              height: 2,
              borderRadius: 1,
              background: EDGE_COLORS[type],
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: MUTED,
              fontFamily: 'DM Mono, monospace',
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
