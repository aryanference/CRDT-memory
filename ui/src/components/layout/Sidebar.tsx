// ui/src/components/layout/Sidebar.tsx
// Left sidebar – ClickHouse-inspired dark + electric-yellow design system.

import { usePCCMStore } from '@/store/pccm'
import { NODE_COLORS, EDGE_COLORS, type NodeType, type EdgeType } from '@/types/pccm'

/* ── Static data ──────────────────────────────────────────── */

const NODE_TYPES: { type: NodeType; label: string; color: string }[] = [
  { type: 'episodic',   label: 'Episodic',   color: '#faff69' },
  { type: 'semantic',   label: 'Semantic',   color: '#22c55e' },
  { type: 'procedural', label: 'Procedural', color: '#3b82f6' },
]

const EDGE_TYPES: { type: EdgeType; label: string; color: string }[] = [
  { type: 'causes',                 label: 'Causes',   color: '#ef4444' },
  { type: 'enables',                label: 'Enables',  color: '#22c55e' },
  { type: 'prevents',               label: 'Prevents', color: '#ef4444' },
  { type: 'temporal_co_occurrence', label: 'Temporal',  color: '#888888' },
]

/* ── Type-tag color map (matches NODE_TYPES) ──────────────── */

const TAG_STYLES: Record<NodeType, { bg: string; text: string }> = {
  episodic:   { bg: 'rgba(250,255,105,0.15)', text: '#faff69' },
  semantic:   { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  procedural: { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatAge(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

/* ── Inline keyframes injected once ───────────────────────── */

const PULSE_KEYFRAMES = `
@keyframes sidebar-pulse-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  70%  { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(2.2); opacity: 0; }
}
`

/* ── Component ────────────────────────────────────────────── */

export default function Sidebar() {
  const selectedNodeId = usePCCMStore(s => s.selectedNodeId)
  const nodes = usePCCMStore(s => s.nodes)
  const injectDemoNode = usePCCMStore(s => s.injectDemoNode)
  const selectNode = usePCCMStore(s => s.selectNode)

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null

  return (
    <aside
      id="pccm-sidebar"
      aria-label="Graph sidebar"
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{
        width: 260,
        background: '#1a1a1a',
        borderRight: '1px solid #2a2a2a',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Inject pulse keyframes */}
      <style>{PULSE_KEYFRAMES}</style>

      <div className="p-4 space-y-5">

        {/* ── Node type legend ───────────────────────────────── */}
        <section id="sidebar-node-legend">
          <h2
            className="mb-2"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#888888',
            }}
          >
            Node Types
          </h2>
          <div className="space-y-1.5">
            {NODE_TYPES.map(({ type, label, color }) => (
              <div key={type} id={`legend-node-${type}`} className="flex items-center gap-2">
                <span
                  className="shrink-0"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: color,
                    opacity: 0.9,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 400, color: '#cccccc' }}>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Edge type legend ───────────────────────────────── */}
        <section id="sidebar-edge-legend">
          <h2
            className="mb-2"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#888888',
            }}
          >
            Edge Types
          </h2>
          <div className="space-y-1.5">
            {EDGE_TYPES.map(({ type, label, color }) => (
              <div key={type} id={`legend-edge-${type}`} className="flex items-center gap-2">
                <span
                  className="shrink-0"
                  style={{
                    width: 20,
                    height: 2,
                    borderRadius: 1,
                    background: color,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 400, color: '#cccccc' }}>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Inject memory button ──────────────────────────── */}
        <button
          id="inject-memory-btn"
          onClick={() => injectDemoNode()}
          className="w-full transition-all duration-150"
          style={{
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: '#faff69',
            color: '#0a0a0a',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#e8ed5c'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#faff69'
          }}
        >
          + Inject memory node
        </button>

        {/* ── HOT node legend ───────────────────────────────── */}
        <div
          id="sidebar-hot-legend"
          className="flex items-center gap-2"
          style={{ fontSize: 12, fontWeight: 400, color: '#888888' }}
        >
          <div className="relative shrink-0" style={{ width: 14, height: 14 }}>
            <span
              style={{
                position: 'absolute',
                inset: 1,
                borderRadius: '50%',
                background: '#faff69',
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid #faff69',
                animation: 'sidebar-pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite',
              }}
            />
          </div>
          <span>Pulsing ring = HOT node (score &gt; 1.0)</span>
        </div>

        {/* ── Selected node detail card ─────────────────────── */}
        {selectedNode && (
          <section id="sidebar-selected-node" style={{ animation: 'slideUp 200ms ease-out' }}>
            <div className="flex items-center justify-between mb-2">
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#888888',
                }}
              >
                Selected Node
              </h2>
              <button
                id="deselect-node-btn"
                onClick={() => selectNode(null)}
                aria-label="Deselect node"
                className="transition-colors duration-150"
                style={{
                  fontSize: 12,
                  color: '#5a5a5a',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: 4,
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#5a5a5a'
                }}
              >
                ✕
              </button>
            </div>

            <div
              className="space-y-3"
              style={{
                background: '#242424',
                borderRadius: 12,
                padding: 14,
                border: '1px solid #2a2a2a',
              }}
            >
              {/* Type tag */}
              <span
                id="selected-node-type-tag"
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: TAG_STYLES[selectedNode.nodeType].bg,
                  color: TAG_STYLES[selectedNode.nodeType].text,
                }}
              >
                {selectedNode.nodeType}
              </span>

              {/* Content */}
              <p
                id="selected-node-content"
                className="line-clamp-4"
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  color: '#ffffff',
                }}
              >
                {selectedNode.content}
              </p>

              {/* Activation score bar */}
              <div id="selected-node-activation">
                <div
                  className="flex justify-between mb-1"
                  style={{ fontSize: 12, fontWeight: 500, color: '#888888' }}
                >
                  <span>Activation</span>
                  <span style={{ fontFamily: 'Inter, monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {selectedNode.activationScore.toFixed(2)}
                  </span>
                </div>
                <div
                  className="overflow-hidden"
                  style={{
                    height: 6,
                    borderRadius: 9999,
                    background: '#2a2a2a',
                  }}
                >
                  <div
                    className="transition-all duration-300"
                    style={{
                      height: '100%',
                      borderRadius: 9999,
                      background: '#faff69',
                      width: `${Math.max(5, Math.min(100, (selectedNode.activationScore + 4) / 8 * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Meta grid */}
              <div
                id="selected-node-meta"
                className="grid grid-cols-2 gap-x-2 gap-y-1"
                style={{ fontSize: 12, color: '#888888' }}
              >
                <span style={{ fontWeight: 500 }}>Accesses</span>
                <span
                  style={{
                    fontFamily: 'Inter, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    color: '#cccccc',
                  }}
                >
                  {selectedNode.accessCount}
                </span>

                <span style={{ fontWeight: 500 }}>State</span>
                <span
                  style={{
                    fontFamily: 'Inter, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color:
                      selectedNode.activationState === 'hot'
                        ? '#faff69'
                        : selectedNode.activationState === 'dormant'
                          ? '#5a5a5a'
                          : '#22c55e',
                  }}
                >
                  {selectedNode.activationState.toUpperCase()}
                </span>

                <span style={{ fontWeight: 500 }}>Age</span>
                <span
                  style={{
                    fontFamily: 'Inter, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    color: '#cccccc',
                  }}
                >
                  {formatAge(selectedNode.createdAtMs)}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}
