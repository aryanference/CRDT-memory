// ui/src/components/swarm/SwarmStats.tsx
// Three stat metric cards – ClickHouse dark + electric yellow design system.

import { usePCCMStore } from '@/store/pccm'

export default function SwarmStats() {
  const writeCount = usePCCMStore(s => s.writeCount)
  const crdtMergeCount = usePCCMStore(s => s.crdtMergeCount)

  const stats = [
    {
      id: 'stat-total-writes',
      label: 'Total writes',
      value: writeCount.toLocaleString(),
      accent: '#faff69',
    },
    {
      id: 'stat-lock-conflicts',
      label: 'Lock conflicts',
      value: '0',
      accent: '#22c55e',
      subtitle: 'CRDT is lock-free',
    },
    {
      id: 'stat-crdt-merges',
      label: 'CRDT merges',
      value: crdtMergeCount.toLocaleString(),
      accent: '#ef4444',
    },
  ] as const

  return (
    <div id="swarm-stats-container" className="grid grid-cols-3 gap-4">
      {stats.map(s => (
        <div
          key={s.id}
          id={s.id}
          className="rounded-lg p-4"
          style={{
            backgroundColor: '#1a1a1a',
            borderTop: `3px solid ${s.accent}`,
          }}
        >
          <div
            className="text-2xl font-bold font-mono mb-1"
            style={{ color: s.accent }}
          >
            {s.value}
          </div>
          <div className="text-sm" style={{ color: '#cccccc' }}>
            {s.label}
          </div>
          {'subtitle' in s && s.subtitle && (
            <div className="text-xs mt-0.5" style={{ color: '#888888' }}>
              {s.subtitle}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
