// ui/src/components/layout/Header.tsx
// Dark header – ClickHouse-inspired dark + electric-yellow design system.

import { usePCCMStore } from '@/store/pccm'

export default function Header() {
  const wsConnected = usePCCMStore(s => s.wsConnected)

  return (
    <header
      id="pccm-header"
      className="flex items-center justify-between px-6 shrink-0"
      style={{
        height: 64,
        background: '#0a0a0a',
        borderBottom: '1px solid #2a2a2a',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── Left: logo mark + title ─────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Logo mark – dark square with yellow accent nodes */}
        <div
          id="pccm-logo"
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="3" fill="#faff69" opacity="0.95" />
            <circle cx="10" cy="3"  r="2" fill="#faff69" opacity="0.55" />
            <circle cx="17" cy="13" r="2" fill="#faff69" opacity="0.55" />
            <circle cx="3"  cy="13" r="2" fill="#faff69" opacity="0.55" />
            <line x1="10" y1="5"   x2="10"   y2="7"    stroke="#faff69" strokeWidth="1.5" opacity="0.6" />
            <line x1="15" y1="11.5" x2="13"  y2="10.5" stroke="#faff69" strokeWidth="1.5" opacity="0.6" />
            <line x1="5"  y1="11.5" x2="7"   y2="10.5" stroke="#faff69" strokeWidth="1.5" opacity="0.6" />
          </svg>
        </div>

        <div>
          <h1
            className="leading-none"
            style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '0.01em' }}
          >
            PCCM
          </h1>
          <p
            className="leading-none mt-0.5"
            style={{ fontSize: 11, fontWeight: 400, color: '#888888' }}
          >
            Predictive CRDT-Distributed Causal Memory
          </p>
        </div>
      </div>

      {/* ── Right: status + version ─────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* WS status */}
        <div
          id="pccm-ws-status"
          className="flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, color: '#888888' }}
        >
          <span
            className="shrink-0"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              display: 'inline-block',
              background: wsConnected ? '#22c55e' : '#5a5a5a',
              boxShadow: wsConnected ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
            }}
          />
          {wsConnected ? 'Live' : 'Demo mode'}
        </div>

        {/* Version badge */}
        <span
          id="pccm-version-badge"
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'Inter, monospace',
            color: '#888888',
            background: '#1a1a1a',
            padding: '2px 10px',
            borderRadius: 9999,
            border: '1px solid #2a2a2a',
          }}
        >
          v0.1.0
        </span>
      </div>
    </header>
  )
}
