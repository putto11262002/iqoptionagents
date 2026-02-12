import type { Signal, StrategyContext, Candle } from "../types/index.ts";

export interface Strategy {
  name: string;
  evaluate(ctx: StrategyContext): Signal;
}

/**
 * Simple momentum strategy (placeholder).
 *
 * Logic:
 * - If the last N candles are all bullish (close > open) → call
 * - If the last N candles are all bearish (close < open) → put
 * - Otherwise → no signal
 *
 * This is intentionally simplistic. Replace with your own strategy.
 */
export class MomentumStrategy implements Strategy {
  name = "Momentum";
  private lookback: number;

  constructor(lookback = 3) {
    this.lookback = lookback;
  }

  evaluate(ctx: StrategyContext): Signal {
    const { candles } = ctx;
    if (candles.length < this.lookback) return null;

    const recent = candles.slice(-this.lookback);
    const allBullish = recent.every((c: Candle) => c.close > c.open);
    const allBearish = recent.every((c: Candle) => c.close < c.open);

    if (allBullish) return "call";
    if (allBearish) return "put";
    return null;
  }
}
