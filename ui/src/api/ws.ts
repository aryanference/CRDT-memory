// ui/src/api/ws.ts
// WebSocket manager with exponential backoff reconnect.

import type { MemoryNode, CausalEdge } from '@/types/pccm'

export type WsEvent =
  | { type: 'node_added'; node: MemoryNode }
  | { type: 'activation_changed'; nodeId: string; newScore: number }
  | { type: 'edge_added'; edge: CausalEdge }
  | { type: 'gossip_sync'; agentId: string; deltaSize: number }

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'

export class PCCMWebSocket {
  private url: string
  private onMessage: (event: WsEvent) => void
  private ws: WebSocket | null = null
  private retryCount = 0
  private maxRetries = 3
  private retryDelays = [2000, 4000, 8000]
  private closed = false

  constructor(path: string, onMessage: (event: WsEvent) => void) {
    this.url = `${WS_URL}${path}`
    this.onMessage = onMessage
    this.connect()
  }

  private connect() {
    if (this.closed) return
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log(`[WS] Connected to ${this.url}`)
        this.retryCount = 0
      }

      this.ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          this.onMessage(data as WsEvent)
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected')
        this.scheduleReconnect()
      }

      this.ws.onerror = (err) => {
        console.warn('[WS] Error:', err)
        // onclose will be called after onerror
      }
    } catch (e) {
      console.warn('[WS] Failed to connect:', e)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.closed || this.retryCount >= this.maxRetries) return
    const delay = this.retryDelays[this.retryCount] ?? 8000
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.retryCount + 1}/${this.maxRetries})`)
    setTimeout(() => {
      this.retryCount++
      this.connect()
    }, delay)
  }

  close() {
    this.closed = true
    this.ws?.close()
  }
}
