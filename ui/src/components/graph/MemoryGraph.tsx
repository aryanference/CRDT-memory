// ui/src/components/graph/MemoryGraph.tsx
// React Flow canvas – ClickHouse-inspired dark + electric-yellow theme.

import { useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { usePCCMStore } from '@/store/pccm'
import {
  NODE_COLORS,
  EDGE_COLORS,
  nodeRadius,
  type NodeType,
  type EdgeType,
} from '@/types/pccm'
import { PCCMWebSocket } from '@/api/ws'

// ── Design tokens ──────────────────────────────────────────────────────
const CANVAS    = '#0a0a0a'
const SURFACE   = '#1a1a1a'
const HAIRLINE  = '#2a2a2a'
const INK       = '#ffffff'
const BODY      = '#cccccc'
const MUTED     = '#888888'
const PRIMARY   = '#faff69'

// ── Keyframe injection (once) ──────────────────────────────────────────
const PULSE_KEYFRAMES = `
@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.55; }
  70%  { transform: scale(1.45); opacity: 0; }
  100% { transform: scale(1.45); opacity: 0; }
}
@keyframes scale-in {
  0%   { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('pccm-graph-keyframes')) {
  const style = document.createElement('style')
  style.id = 'pccm-graph-keyframes'
  style.textContent = PULSE_KEYFRAMES
  document.head.appendChild(style)
}

// ── Custom node renderer ──────────────────────────────────────────────
function MemoryNodeComponent({ data }: { data: any }) {
  const r = nodeRadius(data.activationScore)
  const colors = NODE_COLORS[data.nodeType as NodeType]
  const isHot = data.activationScore > 1.0

  return (
    <div style={{ position: 'relative' }}>
      {/* Pulsing HOT ring */}
      {isHot && (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            border: `2px solid ${colors.stroke}`,
            opacity: 0.5,
            animation: 'pulse-ring 1.6s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main node circle */}
      <div
        id={`memory-node-circle-${data.nodeId ?? ''}`}
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: colors.fill,
          border: `${data.selected ? 2.5 : 1.5}px solid ${colors.stroke}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: data.selected
            ? `0 0 0 3px ${colors.stroke}40, 0 0 16px ${colors.stroke}25`
            : 'none',
        }}
        className={data.isNew ? 'animate-scale-in' : ''}
      >
        <span
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            color: colors.text,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {data.activationScore.toFixed(2)}
        </span>
      </div>

      {/* Label below node */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 5,
          fontSize: 11,
          color: BODY,
          whiteSpace: 'nowrap',
          maxWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
          fontFamily: 'DM Mono, monospace',
        }}
      >
        {data.label}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  memoryNode: MemoryNodeComponent as any,
}

// ── Convert store → React Flow format ──────────────────────────────────

function storeToRFNodes(storeNodes: any[], selectedId: string | null) {
  return storeNodes.map((n, i) => {
    const r = nodeRadius(n.activationScore)
    const angle = (i / storeNodes.length) * 2 * Math.PI
    const radius = 220 + Math.random() * 80
    return {
      id: n.id,
      type: 'memoryNode',
      position: {
        x: 400 + radius * Math.cos(angle),
        y: 300 + radius * Math.sin(angle),
      },
      data: {
        label: n.content.slice(0, 20),
        activationScore: n.activationScore,
        nodeType: n.nodeType,
        nodeId: n.id,
        selected: n.id === selectedId,
        isNew: false,
      },
      style: {
        width: r * 2,
        height: r * 2,
        padding: 0,
        background: 'transparent',
        border: 'none',
      },
    }
  })
}

function storeToRFEdges(storeEdges: any[]) {
  return storeEdges.map(e => ({
    id: e.id,
    source: e.sourceId,
    target: e.targetId,
    type: 'smoothstep',
    style: {
      stroke: EDGE_COLORS[e.edgeType as EdgeType] ?? MUTED,
      strokeWidth: 1.5,
      strokeDasharray: '4 3',
    },
    markerEnd: {
      type: 'arrowclosed' as any,
      color: EDGE_COLORS[e.edgeType as EdgeType] ?? MUTED,
      width: 12,
      height: 12,
    },
    animated: false,
  }))
}

// ── Main component ─────────────────────────────────────────────────────

export default function MemoryGraph() {
  const storeNodes    = usePCCMStore(s => s.nodes)
  const storeEdges    = usePCCMStore(s => s.edges)
  const selectedNodeId = usePCCMStore(s => s.selectedNodeId)
  const selectNode    = usePCCMStore(s => s.selectNode)
  const setWsConnected = usePCCMStore(s => s.setWsConnected)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(
    storeToRFNodes(storeNodes, selectedNodeId),
  )
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(
    storeToRFEdges(storeEdges),
  )

  // Sync store → RF
  useEffect(() => {
    setRfNodes(storeToRFNodes(storeNodes, selectedNodeId))
  }, [storeNodes, selectedNodeId])

  useEffect(() => {
    setRfEdges(storeToRFEdges(storeEdges))
  }, [storeEdges])

  // WebSocket subscription
  useEffect(() => {
    const ws = new PCCMWebSocket('/ws/graph-updates', event => {
      if (event.type === 'node_added') {
        setWsConnected(true)
      } else if (event.type === 'activation_changed') {
        setRfNodes(prev =>
          prev.map(n =>
            n.id === event.nodeId
              ? { ...n, data: { ...n.data, activationScore: event.newScore } }
              : n,
          ),
        )
      }
    })
    return () => ws.close()
  }, [])

  const onNodeClick = useCallback(
    (_: any, node: any) => selectNode(node.id),
    [selectNode],
  )

  const onPaneClick = useCallback(() => selectNode(null), [selectNode])

  return (
    <div
      id="memory-graph-canvas"
      className="relative flex-1 h-full"
      style={{ background: CANVAS }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.2}
        maxZoom={3}
        attributionPosition="bottom-right"
        style={{ background: CANVAS }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={HAIRLINE}
        />

        <Controls
          position="bottom-right"
          style={{
            background: SURFACE,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />

        <MiniMap
          position="top-right"
          nodeColor={n =>
            NODE_COLORS[(n.data?.nodeType as NodeType) ?? 'episodic']?.stroke ??
            MUTED
          }
          maskColor="rgba(10,10,10,0.78)"
          style={{
            background: SURFACE,
            borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
          }}
        />
      </ReactFlow>

      {/* Node / edge count badge */}
      <div
        id="graph-count-badge"
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: SURFACE,
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 9999,
          padding: '5px 14px',
          fontSize: 12,
          fontFamily: 'DM Mono, monospace',
          color: MUTED,
          backdropFilter: 'blur(6px)',
          userSelect: 'none',
        }}
      >
        <span style={{ color: INK, fontWeight: 600 }}>{storeNodes.length}</span>
        {' nodes · '}
        <span style={{ color: INK, fontWeight: 600 }}>{storeEdges.length}</span>
        {' edges'}
      </div>
    </div>
  )
}
