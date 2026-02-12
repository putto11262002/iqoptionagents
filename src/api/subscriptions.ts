import type { Protocol } from "../client/protocol.ts";
import type { IQWebSocket } from "../client/ws.ts";
import type { WsMessage } from "../types/index.ts";
import { TradersMoodSchema } from "../schemas/index.ts";

export class SubscriptionsAPI {
  constructor(
    private protocol: Protocol,
    private ws: IQWebSocket,
  ) {}

  /** Get traders mood (sentiment) for an asset, validated through TradersMoodSchema */
  async getTradersMood(activeId: number, instrument = "turbo-option"): Promise<number> {
    const res = await this.protocol.sendMessage(
      "get-traders-mood",
      "1.0",
      { asset_id: activeId, instrument },
    );
    const parsed = TradersMoodSchema.safeParse(res.msg);
    if (parsed.success) return parsed.data.value;

    console.warn("[SubscriptionsAPI] TradersMood schema warning:", parsed.error?.issues);
    const msg = res.msg as Record<string, unknown>;
    return (msg.value || 0.5) as number;
  }

  /** Subscribe to traders mood updates, validated through TradersMoodSchema */
  subscribeTradersMood(
    activeId: number,
    handler: (mood: number) => void,
  ): void {
    this.ws.on("traders-mood-changed", (msg: WsMessage) => {
      const parsed = TradersMoodSchema.safeParse(msg.msg);
      if (parsed.success) {
        if (parsed.data.asset_id === activeId) {
          handler(parsed.data.value);
        }
      } else {
        console.warn("[SubscriptionsAPI] traders-mood-changed schema warning:", parsed.error.issues);
        const data = msg.msg as Record<string, unknown>;
        if (data.asset_id === activeId) {
          handler(data.value as number);
        }
      }
    });

    this.protocol.subscribe("traders-mood-changed", undefined, {
      asset_id: activeId,
      instrument_type: "turbo-option",
    });
  }

  /** Subscribe to instruments list updates (asset online/offline changes) */
  subscribeInstrumentsList(handler: (data: unknown) => void): void {
    this.ws.on("instruments-list", (msg: WsMessage) => handler(msg.msg));
    this.protocol.subscribe("instruments-list", undefined, {});
  }

  /** Generic subscribe helper */
  subscribe(
    name: string,
    version?: string,
    routingFilters?: Record<string, unknown>,
  ): void {
    this.protocol.subscribe(name, version, routingFilters);
  }

  /** Generic unsubscribe helper */
  unsubscribe(
    name: string,
    version?: string,
    routingFilters?: Record<string, unknown>,
  ): void {
    this.protocol.unsubscribe(name, version, routingFilters);
  }
}
