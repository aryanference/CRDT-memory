// ui/src/components/swarm/AgentOrbs.tsx
// Agent status orbs – ClickHouse dark + electric yellow design system.

import { usePCCMStore } from '@/store/pccm'

const AGENTS = [
  { name: 'Agent-A', initial: 'A', color: '#faff69', onColor: '#0a0a0a' },
  { name: 'Agent-B', initial: 'B', color: '#22c55e', onColor: '#ffffff' },
  { name: 'Agent-C', initial: 'C', color: '#ef4444', onColor: '#ffffff' },
  { name: 'Agent-D', initial: 'D', color: '#3b82f6', onColor: '#ffffff' },
  { name: 'Agent-E', initial: 'E', color: '#f59e0b', onColor: '#0a0a0a' },
] as const

export default function AgentOrbs() {
  const agentCount = usePCCMStore(s => s.agentCount)
  const swarmRunning = usePCCMStore(s => s.swarmRunning)
  const swarmLog = usePCCMStore(s => s.swarmLog)

  return (
    <div id="agent-orbs-container" className="flex items-center gap-3 flex-wrap">
      {Array.from({ length: agentCount }, (_, i) => {
        const agent = AGENTS[i]
        const recentEntry = swarmLog.find(l => l.agent === agent.name)
        const isActive = swarmRunning && !!recentEntry

        return (
          <div
            key={agent.name}
            id={`agent-orb-${agent.initial.toLowerCase()}`}
            className="flex items-center gap-3 rounded-lg p-3 min-w-[148px]"
            style={{
              backgroundColor: '#1a1a1a',
              borderTop: `3px solid ${agent.color}`,
            }}
          >
            {/* Orb */}
            <div className="relative">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: agent.color,
                  color: agent.onColor,
                }}
              >
                {agent.initial}
              </div>

              {/* Pulsing ring when active */}
              {isActive && (
                <div
                  className="absolute inset-[-3px] rounded-full animate-ping"
                  style={{
                    border: `2px solid ${agent.color}`,
                    opacity: 0.5,
                    animationDuration: '1.5s',
                  }}
                />
              )}
            </div>

            {/* Text */}
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: '#ffffff' }}
              >
                {agent.name}
              </div>
              <div
                className="text-xs"
                style={{ color: isActive ? '#22c55e' : '#888888' }}
              >
                {swarmRunning ? (isActive ? 'writing…' : 'idle') : 'idle'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
