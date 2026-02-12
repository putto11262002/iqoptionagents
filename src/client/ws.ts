import type { WsMessage } from "../types/index.ts";

const WS_URL = "wss://ws.iqoption.com/echo/websocket";

type MessageHandler = (msg: WsMessage) => void;

export class IQWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private globalHandlers: Set<MessageHandler> = new Set();
  private connectPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private reconnectDelay = 1000;
  private startTime = Date.now();
  serverTime = 0;

  async connect(): Promise<void> {
    this.startTime = Date.now();
    this.connectPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        this.reconnectDelay = 1000;
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = typeof event.data === "string" ? event.data : "";
        try {
          const msg: WsMessage = JSON.parse(data);
          this.dispatch(msg);
        } catch {
          // ignore non-JSON frames
        }
      };

      this.ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        reject(err);
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        if (this.shouldReconnect) {
          setTimeout(() => this.reconnect(), this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        }
      };
    });

    return this.connectPromise;
  }

  private async reconnect(): Promise<void> {
    console.log("[WS] Reconnecting...");
    try {
      await this.connect();
    } catch {
      // onclose will trigger another reconnect
    }
  }

  private dispatch(msg: WsMessage): void {
    // Handle timeSync heartbeat
    if (msg.name === "timeSync") {
      this.serverTime = msg.msg as number;
    }

    // Notify named handlers
    const handlers = this.handlers.get(msg.name);
    if (handlers) {
      for (const handler of handlers) {
        handler(msg);
      }
    }

    // Notify global handlers
    for (const handler of this.globalHandlers) {
      handler(msg);
    }
  }

  send(data: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(data));
  }

  on(name: string, handler: MessageHandler): void {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, new Set());
    }
    this.handlers.get(name)!.add(handler);
  }

  off(name: string, handler: MessageHandler): void {
    this.handlers.get(name)?.delete(handler);
  }

  onAny(handler: MessageHandler): void {
    this.globalHandlers.add(handler);
  }

  offAny(handler: MessageHandler): void {
    this.globalHandlers.delete(handler);
  }

  getLocalTime(): number {
    return Date.now() - this.startTime;
  }

  close(): void {
    this.shouldReconnect = false;
    this.ws?.close();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
