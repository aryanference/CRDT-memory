// ui/src/components/graph/NodeCard.tsx
// Dark node card – ClickHouse dark + electric-yellow theme.

import { NODE_COLORS, type NodeType } from '@/types/pccm'

// ── Design tokens ──────────────────────────────────────────────────────
const SURFACE_CARD   = '#1a1a1a'
const SURFACE_ELEV   = '#242424'
const HAIRLINE       = '#2a2a2a'
const INK            = '#ffffff'
const BODY           = '#cccccc'
const MUTED          = '#888888'
const ROSE           = '#f43f5e'

interface NodeCardProps {
  nodeId: string
  content: string
  nodeType: NodeType
  activationScore: number
  wasInhibited?: boolean
  compact?: boolean
}

export default function NodeCard({
  nodeId,
  content,
  nodeType,
  activationScore,
  wasInhibited,
  compact,
}: NodeCardProps) {
  const c = NODE_COLORS[nodeType]

  return (
    <div
      id={`node-card-${nodeId}`}
      style={{
        background: SURFACE_CARD,
        borderLeft: `3px solid ${c.stroke}`,
        borderRadius: 8,
        padding: compact ? '8px 12px' : '12px 14px',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow =
          `0 0 0 1px ${HAIRLINE}, 0 4px 16px rgba(0,0,0,0.45)`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {/* Type badge */}
            <span
              id={`node-card-type-${nodeId}`}
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontFamily: 'DM Mono, monospace',
                fontWeight: 600,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                color: c.text,
                background: c.fill,
                border: `1px solid ${c.stroke}30`,
                borderRadius: 4,
                padding: '2px 7px',
                lineHeight: '16px',
              }}
            >
              {nodeType}
            </span>

            {/* Inhibited badge */}
            {wasInhibited && (
              <span
                id={`node-card-inhibited-${nodeId}`}
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontFamily: 'DM Mono, monospace',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  color: ROSE,
                  background: 'rgba(244,63,94,0.1)',
                  border: '1px solid rgba(244,63,94,0.2)',
                  borderRadius: 4,
                  padding: '2px 7px',
                  lineHeight: '16px',
                }}
              >
                inhibited
              </span>
            )}
          </div>

          {/* Content text */}
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.45,
              color: INK,
              fontWeight: 500,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {content}
          </p>

          {/* ID slug */}
          {!compact && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11,
                fontFamily: 'DM Mono, monospace',
                color: MUTED,
              }}
            >
              {nodeId.slice(0, 8)}…
            </p>
          )}
        </div>

        {/* Right column – score */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <span
            id={`node-card-score-${nodeId}`}
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 14,
              fontWeight: 600,
              color: c.stroke,
              letterSpacing: '0.02em',
            }}
          >
            {activationScore.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}
