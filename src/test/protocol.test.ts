import { describe, test, expect } from "bun:test";

// Mock WebSocket that captures sent messages
class MockWebSocket {
  sent: unknown[] = [];
  handlers: Map<string, Function[]> = new Map();
  anyHandlers: Function[] = [];
  serverTime: number = Date.now();

  send(data: unknown) { this.sent.push(data); }
  on(name: string, fn: Function) { /* store handler */ }
  off(name: string, fn: Function) { /* remove handler */ }
  onAny(fn: Function) { this.anyHandlers.push(fn); }
  getLocalTime() { return Math.floor(Date.now() / 1000); }
}

// Import Protocol after mock is ready
import { Protocol } from "../client/protocol.ts";

describe("Protocol Encoding Tests", () => {
  test("sendMessage produces correct envelope", () => {
    const ws = new MockWebSocket();
    const protocol = new Protocol(ws as any);

    // Fire and forget to check envelope
    protocol.sendMessage("core.get-profile", "1.0", {});

    const sent = ws.sent[0] as any;
    expect(sent.name).toBe("sendMessage");
    expect(sent.request_id).toBeDefined();
    expect(sent.local_time).toBeDefined();
    expect(sent.msg.name).toBe("core.get-profile");
    expect(sent.msg.version).toBe("1.0");
    expect(sent.msg.body).toEqual({});
  });

  test("subscribe wraps routingFilters in params", () => {
    const ws = new MockWebSocket();
    const protocol = new Protocol(ws as any);

    protocol.subscribe("candle-generated", undefined, { active_id: 76, size: 1 });

    const sent = ws.sent[0] as any;
    expect(sent.name).toBe("subscribeMessage");
    expect(sent.msg.name).toBe("candle-generated");
    expect(sent.msg.params.routingFilters).toEqual({ active_id: 76, size: 1 });
  });

  test("trade payload uses correct constants", () => {
    const ws = new MockWebSocket();
    const protocol = new Protocol(ws as any);

    protocol.sendMessage("binary-options.open-option", "2.0", {
      user_balance_id: 1090667707,
      active_id: 76,
      option_type_id: 12,
      direction: "call",
      expired: 1770899424,
      refund_value: 0,
      price: 30,
      value: 1082510000,
      profit_percent: 86,
      expiration_size: 60,
    });

    const sent = ws.sent[0] as any;
    expect(sent.msg.body.option_type_id).toBe(12);
    expect(sent.msg.body.value).toBe(1082510000);
    expect(sent.msg.body.direction).toBe("call");
  });

  test("unsubscribe wraps routingFilters in params", () => {
    const ws = new MockWebSocket();
    const protocol = new Protocol(ws as any);

    protocol.unsubscribe("candle-generated", undefined, { active_id: 76, size: 1 });

    const sent = ws.sent[0] as any;
    expect(sent.name).toBe("unsubscribeMessage");
    expect(sent.msg.params.routingFilters).toEqual({ active_id: 76, size: 1 });
  });

  test("fire sends without request_id", () => {
    const ws = new MockWebSocket();
    const protocol = new Protocol(ws as any);

    protocol.fire("setOptions", { sendResults: true });

    const sent = ws.sent[0] as any;
    expect(sent.name).toBe("setOptions");
    expect(sent.msg).toEqual({ sendResults: true });
    expect(sent.request_id).toBeUndefined();
  });

  test("ACK messages are skipped, data response resolves", async () => {
    const ws = new MockWebSocket();
    const protocol = new Protocol(ws as any);

    const promise = protocol.sendMessage("core.get-profile", "1.0", {});
    const requestId = (ws.sent[0] as any).request_id;

    // Simulate ACK
    for (const handler of ws.anyHandlers) {
      handler({ name: "result", request_id: requestId, msg: { success: true } });
    }

    // Simulate data response
    for (const handler of ws.anyHandlers) {
      handler({ name: "profile", request_id: requestId, msg: { user_id: 123 } });
    }

    const result = await promise;
    expect(result.name).toBe("profile");
    expect((result.msg as any).user_id).toBe(123);
  });
});
