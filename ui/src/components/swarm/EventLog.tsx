// ui/src/components/swarm/EventLog.tsx
// Live scrolling event log – ClickHouse dark + electric yellow design system.

import { useEffect, useRef } from 'react'
import { usePCCMStore } from '@/store/pccm'

const AGENT_COLORS: Record<string, string> = {
  'Agent-A': '#faff69',
  'Agent-B': '#22c55e',
  'Agent-C': '#ef4444',
  'Agent-D': '#3b82f6',
  'Agent-E': '#f59e0b',
}

export default function EventLog() {
  const swarmLog = usePCCMStore(s => s.swarmLog)
  const swarmRunning = usePCCMStore(s => s.swarmRunning)
  const topRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top on new entries
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [swarmLog.length])

  if (swarmLog.length === 0) {
    return (
      <div
        id="event-log-empty"
        className="rounded-lg h-[320px] flex items-center justify-center"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <div className="text-center">
          <div className="text-3xl mb-2" style={{ opacity: 0.5 }}>⟳</div>
          <div className="text-sm" style={{ color: '#888888' }}>
            Start the swarm to see live CRDT events
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id="event-log-container"
      className="rounded-lg h-[320px] overflow-y-auto"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div ref={topRef} />

      {swarmLog.map((entry, i) => (
        <div
          key={`${entry.time}-${i}`}
          id={`event-log-row-${i}`}
          className="flex items-center gap-3 px-4 py-2 text-xs transition-colors"
          style={{
            borderBottom: '1px solid #2a2a2a',
            backgroundColor: i === 0 ? 'rgba(250,255,105,0.06)' : undefined,
          }}
          onMouseEnter={e => {
            if (i !== 0) e.currentTarget.style.backgroundColor = '#242424'
          }}
          onMouseLeave={e => {
            if (i !== 0) e.currentTarget.style.backgroundColor = ''
          }}
        >
          {/* Time */}
          <span
            className="font-mono shrink-0 w-20"
            style={{ color: '#888888' }}
          >
            {entry.time}
          </span>

          {/* Agent */}
          <span
            className="font-semibold shrink-0 w-20"
            style={{ color: AGENT_COLORS[entry.agent] ?? '#5a5a5a' }}
          >
            {entry.agent}
          </span>

          {/* Operation */}
          <span
            className="flex-1 truncate"
            style={{ color: '#cccccc' }}
          >
            {entry.op}
          </span>

          {/* ID */}
          <span
            className="font-mono shrink-0"
            style={{ color: '#888888' }}
          >
            {entry.id}
          </span>
        </div>
      ))}
    </div>
  )
}
