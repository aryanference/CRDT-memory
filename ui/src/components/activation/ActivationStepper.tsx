// ui/src/components/activation/ActivationStepper.tsx
// 5-step spreading activation visualiser — ClickHouse dark + yellow design system.

import { usePCCMStore } from '@/store/pccm'

const STEPS = [
  {
    title: 'Semantic Entry Points',
    description: 'Vector search finds semantically similar nodes above the cosine similarity threshold.',
  },
  {
    title: 'Temporal Proximity Scoring',
    description: 'Nodes are scored based on how close they are to the query time window center.',
  },
  {
    title: 'BFS with Priority Queue',
    description: 'Breadth-first traversal propagates activation energy through the causal graph.',
  },
  {
    title: 'Propagated Energy Decay',
    description: 'Energy decays per hop; causal edges (Causes, Enables) get 2× boost over temporal links.',
  },
  {
    title: 'Lateral Inhibition',
    description: 'Dominant nodes suppress similar redundant nodes, pruning the result set.',
  },
]

type StepStatus = 'pending' | 'active' | 'done'

const NODE_TYPE_TAG_STYLE: Record<string, React.CSSProperties> = {
  episodic:   { background: 'rgba(250,255,105,0.12)', color: '#faff69', border: '1px solid rgba(250,255,105,0.3)' },
  semantic:   { background: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' },
  procedural: { background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' },
}

export default function ActivationStepper() {
  const step            = usePCCMStore(s => s.activationStep)
  const activatingIds   = usePCCMStore(s => s.activatingNodeIds)
  const inhibitedIds    = usePCCMStore(s => s.inhibitedNodeIds)
  const nodes           = usePCCMStore(s => s.nodes)
  const result          = usePCCMStore(s => s.lastQueryResult)

  const getStatus = (idx: number): StepStatus => {
    if (step === 0)       return 'pending'
    if (step > idx + 1)   return 'done'
    if (step === idx + 1) return 'active'
    return 'pending'
  }

  const activatedNodes = nodes.filter(n => activatingIds.includes(n.id))
  const inhibitedNodes = nodes.filter(n => inhibitedIds.includes(n.id))

  return (
    <div id="activation-stepper" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {STEPS.map((s, idx) => {
        const status = getStatus(idx)
        const showNodes    = (status === 'active' || status === 'done') && activatingIds.length > 0
        const showInhibited = status === 'done' && idx === 4 && inhibitedNodes.length > 0

        return (
          <div
            key={idx}
            id={`activation-step-${idx + 1}`}
            style={{
              background: '#1a1a1a',
              border: status === 'active'
                ? '1px solid rgba(250,255,105,0.4)'
                : '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '16px',
              boxShadow: status === 'active' ? '0 0 20px rgba(250,255,105,0.08)' : 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* Step circle */}
              <div
                style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2,
                  background: status === 'pending' ? '#242424'
                    : status === 'active' ? '#faff69'
                    : '#22c55e',
                  color: status === 'pending' ? '#888888'
                    : status === 'active' ? '#0a0a0a'
                    : '#ffffff',
                  animation: status === 'active' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {status === 'done' ? '✓' : idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: status === 'pending' ? '#888888' : '#ffffff',
                  marginBottom: status !== 'pending' ? 4 : 0,
                  letterSpacing: 0,
                }}>
                  {s.title}
                </h3>

                {status !== 'pending' && (
                  <p style={{ fontSize: 13, color: '#888888', lineHeight: 1.5, marginBottom: showNodes ? 10 : 0 }}>
                    {s.description}
                  </p>
                )}

                {/* Activated node chips */}
                {showNodes && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {activatedNodes.slice(0, 7).map(n => (
                      <span
                        key={n.id}
                        style={{
                          fontSize: 12, fontWeight: 500,
                          padding: '2px 8px', borderRadius: 9999,
                          ...(NODE_TYPE_TAG_STYLE[n.nodeType] ?? NODE_TYPE_TAG_STYLE.episodic),
                        }}
                      >
                        {n.content.slice(0, 20)}{n.content.length > 20 ? '…' : ''}
                      </span>
                    ))}
                    {activatingIds.length > 7 && (
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        padding: '2px 8px', borderRadius: 9999,
                        background: '#242424', color: '#888888', border: '1px solid #3a3a3a',
                      }}>
                        +{activatingIds.length - 7} more
                      </span>
                    )}
                  </div>
                )}

                {/* Inhibited chips */}
                {showInhibited && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {inhibitedNodes.map(n => (
                      <span
                        key={n.id}
                        style={{
                          fontSize: 12, fontWeight: 500,
                          padding: '2px 8px', borderRadius: 9999,
                          background: 'rgba(239,68,68,0.12)',
                          color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.3)',
                          textDecoration: 'line-through',
                        }}
                      >
                        {n.content.slice(0, 18)}…
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Result panel */}
      {result && (
        <div
          id="activation-result-panel"
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 12,
            padding: 16,
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', marginBottom: 12 }}>
            ✓ Activation complete
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { label: 'Nodes activated',    value: result.activatedNodes.length,                   color: '#faff69' },
              { label: 'Tokens used',        value: result.contextTokensUsed.toLocaleString(),       color: '#ffffff' },
              { label: 'Tokens avoided',     value: result.fullContextTokensAvoided.toLocaleString(), color: '#22c55e' },
              { label: 'Retrieval latency',  value: `${result.latencyMs.toFixed(1)}ms`,             color: '#ffffff' },
            ].map(m => (
              <div
                key={m.label}
                style={{
                  background: '#242424',
                  borderRadius: 8,
                  padding: '12px 14px',
                  border: '1px solid #2a2a2a',
                }}
              >
                <div style={{
                  fontSize: 22, fontWeight: 700, color: m.color,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  letterSpacing: '-0.5px',
                  marginBottom: 4,
                }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 12, color: '#888888' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
