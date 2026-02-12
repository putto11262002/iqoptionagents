import type { Protocol } from "../client/protocol.ts";
import type { IQWebSocket } from "../client/ws.ts";
import type { Profile, Balance, BalanceChanged, WsMessage } from "../types/index.ts";
import { ProfileSchema, BalanceSchema, BalanceChangedSchema } from "../schemas/index.ts";
import { z } from "zod";

export class AccountAPI {
  constructor(
    private protocol: Protocol,
    private ws: IQWebSocket,
  ) {}

  async getProfile(): Promise<Profile> {
    const res = await this.protocol.sendMessage("core.get-profile", "1.0", {});
    const msg = res.msg as Record<string, unknown>;
    // Profile data is nested: { isSuccessful: true, result: { user_id, ... } }
    const raw = (msg.result && typeof msg.result === "object") ? msg.result : msg;
    const parsed = ProfileSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[AccountAPI] Profile schema warning:", parsed.error.issues);
      return raw as unknown as Profile;
    }
    return parsed.data;
  }

  async getBalances(): Promise<Balance[]> {
    const res = await this.protocol.sendMessage(
      "internal-billing.get-balances",
      "1.0",
      {},
    );
    const msg = res.msg as Record<string, unknown>;
    const raw = msg.result || msg;
    const arr = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
    const parsed = z.array(BalanceSchema).safeParse(arr);
    if (!parsed.success) {
      console.warn("[AccountAPI] Balances schema warning:", parsed.error.issues);
      return arr as Balance[];
    }
    return parsed.data;
  }

  /** Get the demo balance (type=4) */
  async getDemoBalance(): Promise<Balance> {
    const balances = await this.getBalances();
    const demo = balances.find((b) => b.type === 4);
    if (!demo) throw new Error("No demo balance found");
    return demo;
  }

  /** Set options like sendResults to receive trade outcomes */
  setOptions(options: Record<string, unknown>): void {
    this.protocol.fire("setOptions", options);
  }

  /** Subscribe to balance-changed events for real-time balance updates */
  subscribeBalanceChanged(handler: (data: BalanceChanged) => void): void {
    this.ws.on("balance-changed", (msg: WsMessage) => {
      const parsed = BalanceChangedSchema.safeParse(msg.msg);
      if (parsed.success) {
        handler(parsed.data);
      } else {
        console.warn("[AccountAPI] balance-changed schema warning:", parsed.error.issues);
      }
    });
    this.protocol.subscribe("balance-changed", "1.0", {});
  }

  /** Switch between demo/real balance */
  async changeBalance(balanceId: number): Promise<void> {
    await this.protocol.sendMessage("change-balance", "1.0", {
      balance_id: balanceId,
    });
  }
}
