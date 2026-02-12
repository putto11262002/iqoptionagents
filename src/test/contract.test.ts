import { describe, test, expect } from "bun:test";
import {
  ProfileSchema,
  BalanceSchema,
  CandleSchema,
  CandlesResponseSchema,
  TradeResponseSchema,
  PositionSchema,
  PositionsResponseSchema,
  HistoryPositionsResponseSchema,
  TradersMoodSchema,
  BalanceChangedSchema,
} from "../schemas/index.ts";

// Synthetic fixtures (hand-crafted)
import optionFixture from "./fixtures/option-response.json";
import positionsFixture from "./fixtures/position-changed.json";

// Real fixtures (captured from live server)
import profileFixture from "./fixtures/profile.json";
import balancesFixture from "./fixtures/balances.json";
import candleFixture from "./fixtures/candle-generated.json";
import candlesBatchFixture from "./fixtures/candles-batch.json";
import historyFixture from "./fixtures/history-positions-response.json";
import getPositionsFixture from "./fixtures/get-positions-response.json";
import tradersMoodFixture from "./fixtures/traders-mood.json";
import tradersMoodChangedFixture from "./fixtures/traders-mood-changed.json";

describe("Contract Tests — Real Server Fixtures", () => {
  test("profile fixture matches ProfileSchema", () => {
    const result = ProfileSchema.safeParse(profileFixture);
    expect(result.success).toBe(true);
  });

  test("all balance fixtures match BalanceSchema", () => {
    expect(balancesFixture.length).toBeGreaterThan(0);
    for (const balance of balancesFixture) {
      const result = BalanceSchema.safeParse(balance);
      expect(result.success).toBe(true);
    }
  });

  test("candle fixture matches CandleSchema with low/high aliases", () => {
    const result = CandleSchema.safeParse(candleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.low).toBe(candleFixture.min);
      expect(result.data.high).toBe(candleFixture.max);
    }
  });

  test("candles batch all match CandleSchema", () => {
    expect(candlesBatchFixture.length).toBeGreaterThan(0);
    for (const candle of candlesBatchFixture) {
      const result = CandleSchema.safeParse(candle);
      expect(result.success).toBe(true);
    }
  });

  test("CandlesResponseSchema validates wrapped candles batch", () => {
    const wrapped = { candles: candlesBatchFixture };
    const result = CandlesResponseSchema.safeParse(wrapped);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.candles.length).toBe(candlesBatchFixture.length);
      // Verify transform aliases applied
      expect(result.data.candles[0]!.low).toBeDefined();
      expect(result.data.candles[0]!.high).toBeDefined();
    }
  });

  test("CandleSchema accepts optional ask/bid/min_at/max_at fields", () => {
    const candleWithExtras = {
      ...candleFixture,
      ask: 1.181500,
      bid: 1.181400,
      min_at: 1770904516,
      max_at: 1770904517,
    };
    const result = CandleSchema.safeParse(candleWithExtras);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ask).toBe(1.181500);
      expect(result.data.bid).toBe(1.181400);
      expect(result.data.min_at).toBe(1770904516);
      expect(result.data.max_at).toBe(1770904517);
    }
  });

  test("get-positions-response matches PositionsResponseSchema", () => {
    const result = PositionsResponseSchema.safeParse(getPositionsFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.positions)).toBe(true);
    }
  });

  test("history positions match PositionSchema (string IDs, no top-level direction)", () => {
    expect(historyFixture.positions.length).toBeGreaterThan(0);
    for (const pos of historyFixture.positions) {
      const result = PositionSchema.safeParse(pos);
      expect(result.success).toBe(true);
      if (result.success) {
        // History positions have string hash IDs
        expect(typeof result.data.id).toBe("string");
        // Direction is inside raw_event, not at top level
        expect(result.data.direction).toBeUndefined();
        expect(pos.raw_event.direction).toBeDefined();
      }
    }
  });

  test("history-positions-response matches HistoryPositionsResponseSchema", () => {
    const result = HistoryPositionsResponseSchema.safeParse(historyFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.positions.length).toBeGreaterThan(0);
    }
  });

  test("traders-mood RPC response matches TradersMoodSchema", () => {
    const result = TradersMoodSchema.safeParse(tradersMoodFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.asset_id).toBe(76);
      expect(result.data.value).toBeGreaterThanOrEqual(0);
      expect(result.data.value).toBeLessThanOrEqual(1);
    }
  });

  test("traders-mood-changed push event matches TradersMoodSchema", () => {
    const result = TradersMoodSchema.safeParse(tradersMoodChangedFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.asset_id).toBe(76);
    }
  });

  test("candle fixture has ask/bid fields from real server", () => {
    const result = CandleSchema.safeParse(candleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ask).toBeDefined();
      expect(result.data.bid).toBeDefined();
    }
  });
});

describe("Contract Tests — Synthetic Fixtures", () => {
  test("option response fixture matches TradeResponseSchema", () => {
    const result = TradeResponseSchema.safeParse(optionFixture);
    expect(result.success).toBe(true);
  });

  test("position-changed fixtures match PositionSchema (numeric IDs, top-level direction)", () => {
    for (const position of positionsFixture) {
      const result = PositionSchema.safeParse(position);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.id).toBe("number");
        expect(result.data.direction).toBeDefined();
      }
    }
  });
});

describe("Contract Tests — New Schemas (Synthetic)", () => {
  test("TradersMoodSchema validates mood data", () => {
    const mood = {
      asset_id: 76,
      value: 0.65,
      instrument_type: "blitz-option",
    };
    const result = TradersMoodSchema.safeParse(mood);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe(0.65);
      expect(result.data.asset_id).toBe(76);
    }
  });

  test("BalanceChangedSchema validates balance change event", () => {
    const event = {
      current_balance: {
        id: 1090667707,
        amount: 1105.75,
        enrolled_amount: 1105.7579,
        bonus_amount: 0,
        currency: "USD",
        type: 4,
      },
    };
    const result = BalanceChangedSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.current_balance.amount).toBe(1105.75);
      expect(result.data.current_balance.id).toBe(1090667707);
    }
  });
});
