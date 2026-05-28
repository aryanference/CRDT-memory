// ui/src/components/activation/FormulaDisplay.tsx
// ACT-R formula mini cards — ClickHouse dark + yellow design system.

import { usePCCMStore } from '@/store/pccm'
import { NODE_COLORS } from '@/types/pccm'

export default function FormulaDisplay() {
  const nodes = usePCCMStore(s => s.nodes)
  const top = [...nodes].sort((a, b) => b.activationScore - a.activationScore).slice(0, 6)

  const barWidth = (score: number) =>
    `${Math.max(4, Math.min(100, (score + 4) / 8 * 100))}%`

  const stateColor = (state: string) => {
    if (state === 'hot')     return '#faff69'
    if (state === 'dormant') return '#888888'
    return '#22c55e'
  }

  return (
    <div id="formula-display" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Formula banner */}
      <div style={{
        background: '#242424',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 4,
      }}>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 12,
          color: '#888888',
          lineHeight: 1.6,
        }}>
          <span style={{ color: '#faff69', fontWeight: 600 }}>B</span>
          <span style={{ color: '#cccccc' }}>ᵢ = ln( Σ t</span>
          <span style={{ color: '#cccccc' }}>ₖ</span>
          <span style={{ color: '#3b82f6' }}>⁻ᵈ</span>
          <span style={{ color: '#cccccc' }}> )</span>
          <span style={{ color: '#5a5a5a' }}> where d = 0.5</span>
        </span>
      </div>

      {/* Node cards */}
      {top.map(n => {
        const c = NODE_COLORS[n.nodeType]
        return (
          <div
            key={n.id}
            id={`formula-node-${n.id}`}
            style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderLeft: `3px solid ${c.stroke}`,
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            {/* Top row: content + score */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 13,
                color: '#e6e6e6',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {n.content.slice(0, 38)}{n.content.length > 38 ? '…' : ''}
              </span>
              <span style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 13,
                fontWeight: 600,
                color: c.stroke,
                flexShrink: 0,
              }}>
                B={n.activationScore.toFixed(3)}
              </span>
            </div>

            {/* Activation bar */}
            <div style={{
              height: 4,
              background: '#242424',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 8,
            }}>
              <div style={{
                height: '100%',
                width: barWidth(n.activationScore),
                background: c.stroke,
                borderRadius: 2,
                transition: 'width 0.5s ease',
              }} />
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#888888' }}>
                {n.accessCount} accesses
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: '1px 8px', borderRadius: 9999,
                background: `${stateColor(n.activationState)}18`,
                color: stateColor(n.activationState),
                border: `1px solid ${stateColor(n.activationState)}40`,
                letterSpacing: '0.5px',
              }}>
                {n.activationState.toUpperCase()}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
