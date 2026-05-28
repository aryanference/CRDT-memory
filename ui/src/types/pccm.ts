// ui/src/types/pccm.ts
// Shared TypeScript types for the PCCM dashboard.

export type NodeType = 'episodic' | 'semantic' | 'procedural'
export type EdgeType = 'causes' | 'caused_by' | 'enables' | 'prevents' | 'temporal_co_occurrence'
export type ActivationState = 'hot' | 'active' | 'dormant'
export type Tab = 'graph' | 'activation' | 'benchmark' | 'swarm'

export interface MemoryNode {
  id: string
  content: string
  nodeType: NodeType
  activationScore: number
  activationState: ActivationState
  agentId: string
  createdAtMs: number
  lastAccessedMs: number
  accessCount: number
  metadata: Record<string, string>
}

export interface CausalEdge {
  id: string
  sourceId: string
  targetId: string
  edgeType: EdgeType
  weight: number
  createdAtMs: number
}

export interface ActivatedNodeResult {
  nodeId: string
  content: string
  nodeType: NodeType
  activationScore: number
  temporalScore: number
  propagationPath: string[]
  wasInhibited: boolean
}

export interface QueryResponse {
  activatedNodes: ActivatedNodeResult[]
  contextTokensUsed: number
  fullContextTokensAvoided: number
  latencyMs: number
  prefetchCacheHits: number
}

export interface SwarmLogEntry {
  time: string
  agent: string
  op: string
  id: string
}

// ── Color helpers (Dark + Electric Yellow theme) ───────────

export const NODE_COLORS: Record<NodeType, { fill: string; stroke: string; text: string }> = {
  episodic:   { fill: '#1a1a0a', stroke: '#faff69', text: '#faff69' },
  semantic:   { fill: '#0a1a0f', stroke: '#22c55e', text: '#22c55e' },
  procedural: { fill: '#0a0f1a', stroke: '#3b82f6', text: '#3b82f6' },
}

export const EDGE_COLORS: Record<EdgeType, string> = {
  causes:                '#ef4444',
  caused_by:             '#ef4444',
  enables:               '#22c55e',
  prevents:              '#ef4444',
  temporal_co_occurrence:'#888888',
}

/** Compute node radius in px from activation score. */
export function nodeRadius(activationScore: number): number {
  return Math.max(22, Math.min(44, 18 + activationScore * 12))
}

// ── Mock data for demo ─────────────────────────────────────

export const DEMO_NODES: MemoryNode[] = [
  { id: 'n1', content: 'Agent received user query about Q4 revenue growth', nodeType: 'episodic', activationScore: 2.1, activationState: 'hot', agentId: 'demo', createdAtMs: Date.now() - 3_600_000, lastAccessedMs: Date.now() - 60_000, accessCount: 8, metadata: {} },
  { id: 'n2', content: 'Called database query tool for financial data', nodeType: 'episodic', activationScore: 1.3, activationState: 'hot', agentId: 'demo', createdAtMs: Date.now() - 3_500_000, lastAccessedMs: Date.now() - 120_000, accessCount: 5, metadata: {} },
  { id: 'n3', content: 'Revenue increased 23% year-over-year in Q4', nodeType: 'semantic', activationScore: 0.8, activationState: 'active', agentId: 'demo', createdAtMs: Date.now() - 3_400_000, lastAccessedMs: Date.now() - 300_000, accessCount: 3, metadata: {} },
  { id: 'n4', content: 'User satisfied with Q4 analysis response', nodeType: 'episodic', activationScore: 0.4, activationState: 'active', agentId: 'demo', createdAtMs: Date.now() - 3_300_000, lastAccessedMs: Date.now() - 600_000, accessCount: 2, metadata: {} },
  { id: 'n5', content: 'Financial report analysis workflow', nodeType: 'procedural', activationScore: 0.2, activationState: 'active', agentId: 'demo', createdAtMs: Date.now() - 7_200_000, lastAccessedMs: Date.now() - 1_800_000, accessCount: 12, metadata: {} },
  { id: 'n6', content: 'User prefers concise bullet-point responses', nodeType: 'semantic', activationScore: -0.5, activationState: 'active', agentId: 'demo', createdAtMs: Date.now() - 86_400_000, lastAccessedMs: Date.now() - 3_600_000, accessCount: 4, metadata: {} },
  { id: 'n7', content: 'Tool call: search_documents("annual report")', nodeType: 'episodic', activationScore: -1.2, activationState: 'active', agentId: 'demo', createdAtMs: Date.now() - 172_800_000, lastAccessedMs: Date.now() - 7_200_000, accessCount: 1, metadata: {} },
]

export const DEMO_EDGES: CausalEdge[] = [
  { id: 'e1', sourceId: 'n1', targetId: 'n2', edgeType: 'causes', weight: 1.0, createdAtMs: Date.now() - 3_490_000 },
  { id: 'e2', sourceId: 'n2', targetId: 'n3', edgeType: 'enables', weight: 0.9, createdAtMs: Date.now() - 3_390_000 },
  { id: 'e3', sourceId: 'n3', targetId: 'n4', edgeType: 'causes', weight: 0.8, createdAtMs: Date.now() - 3_290_000 },
  { id: 'e4', sourceId: 'n5', targetId: 'n2', edgeType: 'enables', weight: 0.7, createdAtMs: Date.now() - 3_450_000 },
  { id: 'e5', sourceId: 'n6', targetId: 'n4', edgeType: 'temporal_co_occurrence', weight: 0.5, createdAtMs: Date.now() - 3_250_000 },
]
