// ui/src/App.tsx
// Main application with 4-tab layout — ClickHouse dark + electric yellow design system.

import { usePCCMStore } from '@/store/pccm'
import Header from '@/components/layout/Header'
import TabBar from '@/components/layout/TabBar'
import Sidebar from '@/components/layout/Sidebar'

// Tab panels
import MemoryGraph from '@/components/graph/MemoryGraph'
import ActivationStepper from '@/components/activation/ActivationStepper'
import ScoreTimeline from '@/components/activation/ScoreTimeline'
import FormulaDisplay from '@/components/activation/FormulaDisplay'
import MetricBars from '@/components/benchmark/MetricBars'
import BenchmarkTable from '@/components/benchmark/BenchmarkTable'
import AgentOrbs from '@/components/swarm/AgentOrbs'
import SwarmStats from '@/components/swarm/SwarmStats'
import EventLog from '@/components/swarm/EventLog'

// ── Benchmark data (hardcoded from LoCoMo results) ────────────
const ACCURACY_DATA = [
  { name: 'PCCM',    value: 90.1, unit: '%' },
  { name: 'Genesys', value: 89.9, unit: '%' },
  { name: 'Zep/Graphiti', value: 75.1, unit: '%' },
  { name: 'Mem0',    value: 67.1, unit: '%' },
  { name: 'Honcho',  value: 61.4, unit: '%' },
]

const LATENCY_DATA = [
  { name: 'PCCM',    value: 8,   unit: 'ms' },
  { name: 'Mem0',    value: 45,  unit: 'ms' },
  { name: 'Zep/Graphiti', value: 190, unit: 'ms' },
  { name: 'Genesys', value: 340, unit: 'ms' },
  { name: 'Honcho',  value: 520, unit: 'ms' },
]

const TOKEN_DATA = [
  { name: 'PCCM',    value: 1247,  unit: '' },
  { name: 'Genesys', value: 4200,  unit: '' },
  { name: 'Zep/Graphiti', value: 7800, unit: '' },
  { name: 'Mem0',    value: 8100,  unit: '' },
  { name: 'Honcho',  value: 12400, unit: '' },
]

// ── Tab panels ────────────────────────────────────────────────

function GraphPanel() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <MemoryGraph />
    </div>
  )
}

function ActivationPanel() {
  const queryText = usePCCMStore(s => s.queryText)
  const setQueryText = usePCCMStore(s => s.setQueryText)
  const runActivation = usePCCMStore(s => s.runActivation)
  const isActivating = usePCCMStore(s => s.isActivating)

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main stepper area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight mb-1">Spreading Activation</h2>
          <p className="text-sm text-[#cccccc]">
            Watch the 5-step temporal spreading activation algorithm execute in real time.
          </p>
        </div>

        {/* Query row */}
        <div className="flex gap-2">
          <input
            id="activation-query-input"
            type="text"
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runActivation()}
            placeholder="e.g. What financial data was retrieved?"
            className="flex-1 px-4 py-2.5 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-[#5a5a5a] focus:outline-none focus:ring-2 focus:ring-[#faff69]/40 focus:border-[#faff69]"
          />
          <button
            id="run-activation-btn"
            onClick={runActivation}
            disabled={isActivating || !queryText.trim()}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all
              ${isActivating
                ? 'bg-[#3a3a1f] text-[#888888] cursor-not-allowed'
                : 'bg-[#faff69] hover:bg-[#e6eb52] text-[#0a0a0a] shadow-sm'
              }`}
          >
            {isActivating ? 'Running…' : 'Run activation'}
          </button>
        </div>

        <ActivationStepper />
      </div>

      {/* Right panel: formula + curve */}
      <div className="w-[320px] shrink-0 border-l border-[#2a2a2a] overflow-y-auto p-4 space-y-4 bg-[#121212]">
        <ScoreTimeline />
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Node Activation Scores</h3>
          <FormulaDisplay />
        </div>
      </div>
    </div>
  )
}

function BenchmarkPanel() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-4xl mx-auto w-full">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">LoCoMo Benchmark Results</h2>
        <p className="text-sm text-[#cccccc] mt-1">
          Evaluated on the LoCoMo long-context conversational memory benchmark.
          PCCM achieves state-of-the-art across all three key metrics.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card p-5">
          <MetricBars
            title="LLM Judge Accuracy (%)"
            systems={ACCURACY_DATA}
            lowerIsBetter={false}
            formatValue={v => `${v}%`}
          />
        </div>
        <div className="card p-5">
          <MetricBars
            title="Retrieval Latency (ms)"
            systems={LATENCY_DATA}
            lowerIsBetter={true}
            formatValue={v => `${v}ms`}
          />
        </div>
        <div className="card p-5">
          <MetricBars
            title="Context Tokens per Query"
            systems={TOKEN_DATA}
            lowerIsBetter={true}
            formatValue={v => v.toLocaleString()}
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Feature Comparison</h3>
        <BenchmarkTable />
      </div>
    </div>
  )
}

function SwarmPanel() {
  const swarmRunning = usePCCMStore(s => s.swarmRunning)
  const agentCount = usePCCMStore(s => s.agentCount)
  const startSwarm = usePCCMStore(s => s.startSwarm)
  const stopSwarm = usePCCMStore(s => s.stopSwarm)
  const setAgentCount = usePCCMStore(s => s.setAgentCount)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">CRDT Swarm Simulation</h2>
        <p className="text-sm text-[#cccccc] mt-1">
          Multiple agents write concurrently — zero lock conflicts guaranteed by CRDT semantics.
          This is a client-side simulation demonstrating the lock-free property.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium">Agents:</span>
          {[2, 3, 4, 5].map(n => (
            <button
              key={n}
              id={`agent-count-${n}`}
              onClick={() => setAgentCount(n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all
                ${agentCount === n
                  ? 'bg-[#faff69] text-[#0a0a0a] shadow-[0_0_12px_rgba(250,255,105,0.3)]'
                  : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#cccccc] hover:border-[#3a3a3a]'
                }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          id="swarm-toggle-btn"
          onClick={swarmRunning ? stopSwarm : startSwarm}
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all
            ${swarmRunning
              ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
              : 'bg-[#22c55e] hover:bg-[#16a34a] text-white'
            }`}
        >
          {swarmRunning ? '■ Stop swarm' : '▶ Start swarm'}
        </button>
      </div>

      {/* Agent orbs */}
      <AgentOrbs />

      {/* Stats */}
      <SwarmStats />

      {/* Event log */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Live CRDT Event Stream</h3>
        <EventLog />
      </div>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────

export default function App() {
  const activeTab = usePCCMStore(s => s.activeTab)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0a]">
      <Header />
      <TabBar />

      {/* Tab panels */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div
          role="tabpanel"
          id="panel-graph"
          aria-labelledby="tab-graph"
          hidden={activeTab !== 'graph'}
          className={`flex flex-col flex-1 overflow-hidden ${activeTab === 'graph' ? '' : 'hidden'}`}
        >
          <GraphPanel />
        </div>

        <div
          role="tabpanel"
          id="panel-activation"
          aria-labelledby="tab-activation"
          className={`flex flex-col flex-1 overflow-hidden ${activeTab !== 'activation' ? 'hidden' : ''}`}
        >
          <ActivationPanel />
        </div>

        <div
          role="tabpanel"
          id="panel-benchmark"
          aria-labelledby="tab-benchmark"
          className={`flex flex-col flex-1 overflow-hidden ${activeTab !== 'benchmark' ? 'hidden' : ''}`}
        >
          <BenchmarkPanel />
        </div>

        <div
          role="tabpanel"
          id="panel-swarm"
          aria-labelledby="tab-swarm"
          className={`flex flex-col flex-1 overflow-hidden ${activeTab !== 'swarm' ? 'hidden' : ''}`}
        >
          <SwarmPanel />
        </div>
      </main>
    </div>
  )
}
