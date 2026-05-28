// ui/src/store/pccm.ts
// Zustand store for the PCCM dashboard state.

import { create } from 'zustand'
import {
  MemoryNode, CausalEdge, QueryResponse, SwarmLogEntry,
  DEMO_NODES, DEMO_EDGES
} from '@/types/pccm'
import { apiClient } from '@/api/client'

interface PCCMState {
  // ── Graph tab ────────────────────────────────────────────
  nodes: MemoryNode[]
  edges: CausalEdge[]
  selectedNodeId: string | null

  // ── Activation tab ───────────────────────────────────────
  activationStep: number
  activatingNodeIds: string[]
  inhibitedNodeIds: string[]
  isActivating: boolean
  queryText: string
  lastQueryResult: QueryResponse | null

  // ── Swarm tab ────────────────────────────────────────────
  swarmRunning: boolean
  agentCount: number
  swarmLog: SwarmLogEntry[]
  writeCount: number
  crdtMergeCount: number

  // ── Connection ───────────────────────────────────────────
  wsConnected: boolean
  activeTab: import('@/types/pccm').Tab

  // ── Actions ──────────────────────────────────────────────
  addNode: (node: MemoryNode) => void
  selectNode: (id: string | null) => void
  setQueryText: (text: string) => void
  runActivation: () => Promise<void>
  startSwarm: () => void
  stopSwarm: () => void
  setAgentCount: (n: number) => void
  appendSwarmLog: (entry: SwarmLogEntry) => void
  setWsConnected: (connected: boolean) => void
  setActiveTab: (tab: import('@/types/pccm').Tab) => void
  injectDemoNode: () => Promise<void>
}

// ── Swarm simulation helpers ──────────────────────────────
const AGENT_NAMES = ['Agent-A', 'Agent-B', 'Agent-C', 'Agent-D', 'Agent-E']
const OPS = [
  'stored episodic node',
  'updated activation score',
  'drew causal edge',
  'synced CRDT delta',
  'queried spreading activation',
]
let _swarmTimer: number | null = null

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const usePCCMStore = create<PCCMState>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────
  nodes: DEMO_NODES,
  edges: DEMO_EDGES,
  selectedNodeId: null,

  activationStep: 0,
  activatingNodeIds: [],
  inhibitedNodeIds: [],
  isActivating: false,
  queryText: '',
  lastQueryResult: null,

  swarmRunning: false,
  agentCount: 3,
  swarmLog: [],
  writeCount: 0,
  crdtMergeCount: 0,

  wsConnected: false,
  activeTab: 'graph',

  // ── Actions ───────────────────────────────────────────────
  addNode: (node) =>
    set((s) => ({ nodes: [node, ...s.nodes] })),

  selectNode: (id) =>
    set({ selectedNodeId: id }),

  setQueryText: (text) =>
    set({ queryText: text }),

  setWsConnected: (connected) =>
    set({ wsConnected: connected }),

  setActiveTab: (tab) =>
    set({ activeTab: tab }),

  appendSwarmLog: (entry) =>
    set((s) => ({
      swarmLog: [entry, ...s.swarmLog].slice(0, 200),
    })),

  setAgentCount: (n) =>
    set({ agentCount: n }),

  // ── Run activation (5-step simulation) ───────────────────
  runActivation: async () => {
    const { queryText, nodes } = get()
    if (!queryText.trim() || get().isActivating) return

    set({ isActivating: true, activationStep: 0, activatingNodeIds: [], inhibitedNodeIds: [], lastQueryResult: null })

    // Try real API first, fall back to simulation
    try {
      const resp = await apiClient.post('/query', {
        query_text: queryText,
        agent_id: 'demo',
        semantic_threshold: 0.5,
        max_nodes: 20,
      })
      const data: QueryResponse = {
        activatedNodes: resp.data.activated_nodes?.map((n: any) => ({
          nodeId: n.node_id,
          content: n.content,
          nodeType: n.node_type,
          activationScore: n.activation_score,
          temporalScore: n.temporal_score,
          propagationPath: n.propagation_path,
          wasInhibited: n.was_inhibited,
        })) ?? [],
        contextTokensUsed: resp.data.context_tokens_used ?? 0,
        fullContextTokensAvoided: resp.data.full_context_tokens_avoided ?? 0,
        latencyMs: resp.data.latency_ms ?? 0,
        prefetchCacheHits: 0,
      }
      await simulateSteps(data.activatedNodes, set)
      set({ lastQueryResult: data, isActivating: false })
    } catch {
      // Simulation mode
      await simulateStepsLocal(nodes, queryText, set)
      set({ isActivating: false })
    }
  },

  // ── Swarm simulation ──────────────────────────────────────
  startSwarm: () => {
    set({ swarmRunning: true, swarmLog: [], writeCount: 0, crdtMergeCount: 0 })

    const tick = () => {
      const { agentCount, swarmRunning } = get()
      if (!swarmRunning) return

      const agentIdx = Math.floor(Math.random() * agentCount)
      const agent = AGENT_NAMES[agentIdx]
      const op = OPS[Math.floor(Math.random() * OPS.length)]
      const isMerge = op === 'synced CRDT delta'

      const entry: SwarmLogEntry = {
        time: formatTime(),
        agent,
        op,
        id: shortId(),
      }

      set((s) => ({
        swarmLog: [entry, ...s.swarmLog].slice(0, 200),
        writeCount: s.writeCount + 1,
        crdtMergeCount: isMerge ? s.crdtMergeCount + 1 : s.crdtMergeCount,
      }))

      _swarmTimer = window.setTimeout(tick, 120 + Math.random() * 120)
    }

    tick()
  },

  stopSwarm: () => {
    if (_swarmTimer !== null) clearTimeout(_swarmTimer)
    set({ swarmRunning: false })
  },

  // ── Inject a demo node into the graph ─────────────────────
  injectDemoNode: async () => {
    const contents = [
      'Agent retrieved pricing data from CRM',
      'User asked about competitor analysis',
      'Tool call: web_search("market trends 2024")',
      'LLM generated executive summary',
      'Error: API rate limit exceeded, retrying...',
      'Consolidated knowledge: market share is 23%',
    ]
    const types = ['episodic', 'semantic', 'procedural'] as const
    const content = contents[Math.floor(Math.random() * contents.length)]
    const nodeType = types[Math.floor(Math.random() * types.length)]
    const score = Math.random() * 3 - 1

    try {
      const resp = await apiClient.post('/agents/demo/events', {
        agent_id: 'demo',
        content,
        event_type: 'observation',
        metadata: {},
      })
      const newNode: MemoryNode = {
        id: resp.data.node_id,
        content,
        nodeType,
        activationScore: resp.data.activation_score,
        activationState: resp.data.activation_score > 1.0 ? 'hot' : 'active',
        agentId: 'demo',
        createdAtMs: Date.now(),
        lastAccessedMs: Date.now(),
        accessCount: 1,
        metadata: {},
      }
      get().addNode(newNode)
    } catch {
      // Demo mode fallback
      const newNode: MemoryNode = {
        id: `demo-${shortId()}`,
        content,
        nodeType,
        activationScore: score,
        activationState: score > 1.0 ? 'hot' : score > -3.5 ? 'active' : 'dormant',
        agentId: 'demo',
        createdAtMs: Date.now(),
        lastAccessedMs: Date.now(),
        accessCount: 1,
        metadata: {},
      }
      get().addNode(newNode)
    }
  },
}))

// ── Simulation helpers ────────────────────────────────────────────────

async function simulateSteps(
  activatedNodes: any[],
  set: (partial: Partial<PCCMState>) => void
) {
  const nodeIds = activatedNodes.map(n => n.nodeId)
  const inhibited = activatedNodes.filter(n => n.wasInhibited).map(n => n.nodeId)

  for (let step = 1; step <= 5; step++) {
    set({ activationStep: step })
    const count = Math.ceil((step / 5) * nodeIds.length)
    set({ activatingNodeIds: nodeIds.slice(0, count) })
    if (step === 5) set({ inhibitedNodeIds: inhibited })
    await delay(700)
  }
}

async function simulateStepsLocal(
  nodes: MemoryNode[],
  _query: string,
  set: (partial: Partial<PCCMState>) => void
) {
  const active = [...nodes].sort((a, b) => b.activationScore - a.activationScore)
  const count = Math.min(5, active.length)
  const topIds = active.slice(0, count).map(n => n.id)
  const inhibitedIdx = Math.floor(count * 0.3)

  for (let step = 1; step <= 5; step++) {
    set({ activationStep: step })
    const revealed = topIds.slice(0, Math.ceil((step / 5) * count))
    set({ activatingNodeIds: revealed })
    if (step === 5) set({ inhibitedNodeIds: topIds.slice(inhibitedIdx) })
    await delay(700)
  }

  const totalTokens = active.slice(0, count).reduce((acc, n) => acc + Math.ceil(n.content.split(' ').length * 1.3), 0)
  const fullTokens = nodes.reduce((acc, n) => acc + Math.ceil(n.content.split(' ').length * 1.3), 0)

  set({
    lastQueryResult: {
      activatedNodes: active.slice(0, count).map(n => ({
        nodeId: n.id,
        content: n.content,
        nodeType: n.nodeType,
        activationScore: n.activationScore,
        temporalScore: 0.5,
        propagationPath: [n.id],
        wasInhibited: false,
      })),
      contextTokensUsed: totalTokens,
      fullContextTokensAvoided: fullTokens - totalTokens,
      latencyMs: 8 + Math.random() * 4,
      prefetchCacheHits: 0,
    },
  })
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
