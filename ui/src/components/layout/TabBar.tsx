// ui/src/components/layout/TabBar.tsx
// 4-tab navigation – ClickHouse-inspired dark + electric-yellow design system.

import { usePCCMStore } from '@/store/pccm'
import type { Tab } from '@/types/pccm'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'graph',      label: 'Graph',      icon: '⬡' },
  { id: 'activation', label: 'Activation', icon: '⚡' },
  { id: 'benchmark',  label: 'Benchmark',  icon: '📊' },
  { id: 'swarm',      label: 'Swarm',      icon: '🔄' },
]

export default function TabBar() {
  const activeTab = usePCCMStore(s => s.activeTab)
  const setActiveTab = usePCCMStore(s => s.setActiveTab)

  return (
    <nav
      id="pccm-tabbar"
      role="tablist"
      aria-label="Dashboard sections"
      className="flex items-center gap-1 px-6 shrink-0"
      style={{
        background: '#0a0a0a',
        borderBottom: '1px solid #2a2a2a',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-3 transition-colors duration-150"
            style={{
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#faff69' : '#888888',
              borderBottom: `2px solid ${isActive ? '#faff69' : 'transparent'}`,
              background: 'transparent',
              cursor: 'pointer',
              outline: 'none',
              border: 'none',
              borderBottomWidth: 2,
              borderBottomStyle: 'solid',
              borderBottomColor: isActive ? '#faff69' : 'transparent',
              marginBottom: -1,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                ;(e.currentTarget as HTMLButtonElement).style.color = '#cccccc'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                ;(e.currentTarget as HTMLButtonElement).style.color = '#888888'
              }
            }}
          >
            <span className="leading-none" style={{ fontSize: 16 }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
