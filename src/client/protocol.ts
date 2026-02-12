import type { WsMessage } from "../types/index.ts";
import type { IQWebSocket } from "./ws.ts";
import type { ZodType } from "zod";

interface PendingRequest {
  resolve: (msg: WsMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  schema?: ZodType;
}

/**
 * IQ Option protocol layer.
 *
 * Protocol quirk: `sendMessage` RPCs get TWO responses with the SAME request_id:
 *   1. ACK: `{ name: "result", request_id, msg: { success: true } }`
 *   2. DATA: `{ name: "<responseName>", request_id, msg: <actual data> }`
 *
 * We skip ACK messages (name === "result") and resolve on the data response.
 * All resolution uses request_id — no name-based matching, no race conditions.
 */
export class Protocol {
  private requestId = 0;
  private pending: Map<string, PendingRequest> = new Map();
  private timeout: number;

  constructor(
    private ws: IQWebSocket,
    timeout = 15000,
  ) {
    this.timeout = timeout;

    this.ws.onAny((msg: WsMessage) => {
      // Skip ACK messages — wait for the real data response
      if (msg.name === "result") return;

      if (msg.request_id && this.pending.has(msg.request_id)) {
        const req = this.pending.get(msg.request_id)!;
        this.pending.delete(msg.request_id);
        clearTimeout(req.timer);

        // If a Zod schema was provided, parse msg.msg through it
        if (req.schema) {
          const parsed = req.schema.safeParse(msg.msg);
          if (!parsed.success) {
            console.warn(
              `[Protocol] Schema validation warning for ${msg.name}:`,
              parsed.error.issues,
            );
          }
        }

        req.resolve(msg);
      }
    });
  }

  private nextId(): string {
    return String(++this.requestId);
  }

  /** Send a raw top-level message and await its response by request_id */
  async send(
    name: string,
    msg: unknown,
    expectResponse = true,
  ): Promise<WsMessage> {
    const request_id = this.nextId();

    const envelope: Record<string, unknown> = {
      name,
      request_id,
      msg,
    };

    if (name === "sendMessage") {
      envelope.local_time = this.ws.getLocalTime();
    }

    this.ws.send(envelope);

    if (!expectResponse) {
      return { name: "", msg: null } as WsMessage;
    }

    return new Promise<WsMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request_id);
        reject(new Error(`Request ${name} (id=${request_id}) timed out`));
      }, this.timeout);

      this.pending.set(request_id, { resolve, reject, timer });
    });
  }

  /**
   * Send an inner RPC wrapped in the sendMessage envelope.
   * Waits for the actual data response (not the ACK).
   * Optionally validates the response with a Zod schema.
   */
  async sendMessage(
    innerName: string,
    version: string,
    body: Record<string, unknown>,
    schema?: ZodType,
  ): Promise<WsMessage> {
    const request_id = this.nextId();

    const envelope: Record<string, unknown> = {
      name: "sendMessage",
      request_id,
      local_time: this.ws.getLocalTime(),
      msg: {
        name: innerName,
        version,
        body,
      },
    };

    this.ws.send(envelope);

    return new Promise<WsMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request_id);
        reject(
          new Error(`sendMessage ${innerName} (id=${request_id}) timed out`),
        );
      }, this.timeout);

      this.pending.set(request_id, { resolve, reject, timer, schema });
    });
  }

  /** Send a fire-and-forget message (no request_id tracking) */
  fire(name: string, msg: unknown): void {
    this.ws.send({
      name,
      msg,
    });
  }

  /** Subscribe to a server-pushed message type */
  subscribe(
    name: string,
    version?: string,
    routingFilters?: Record<string, unknown>,
  ): void {
    const msg: Record<string, unknown> = { name };
    if (version) msg.version = version;
    if (routingFilters) {
      msg.params = { routingFilters };
    }

    this.ws.send({
      name: "subscribeMessage",
      msg,
    });
  }

  /** Unsubscribe from a server-pushed message type */
  unsubscribe(
    name: string,
    version?: string,
    routingFilters?: Record<string, unknown>,
  ): void {
    const msg: Record<string, unknown> = { name };
    if (version) msg.version = version;
    if (routingFilters) {
      msg.params = { routingFilters };
    }

    this.ws.send({
      name: "unsubscribeMessage",
      msg,
    });
  }

  /** Register a handler for a specific incoming message name */
  on(name: string, handler: (msg: WsMessage) => void): void {
    this.ws.on(name, handler);
  }

  /** Remove a handler */
  off(name: string, handler: (msg: WsMessage) => void): void {
    this.ws.off(name, handler);
  }
}
