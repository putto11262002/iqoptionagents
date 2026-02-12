import type { Candle, Position } from "../../types/index.ts";
import type {
  Agent,
  Action,
  Observation,
  TradingEnvironmentInterface,
} from "../../env/types.ts";
import { SensorManager } from "../../env/sensors.ts";

/**
 * MomentumAgent — port of MomentumStrategy to the Agent interface.
 *
 * Logic: If the last N candles are all bullish → call, all bearish → put.
 * The agent subscribes to candle and position sensors on initialize.
 */
export class MomentumAgent implements Agent {
  name = "Momentum";
  private lookback: number;
  private activeId: number;
  private candleSize: number;
  private tradeAmount: number;
  private expirationSize: number;
  private balanceId: number = 0;
  private profitPercent: number = 86;
  private lastTradeTime: number = 0;
  private tradeCount: number = 0;

  constructor(options: {
    activeId: number;
    candleSize?: number;
    lookback?: number;
    tradeAmount?: number;
    expirationSize?: number;
    profitPercent?: number;
  }) {
    this.activeId = options.activeId;
    this.candleSize = options.candleSize || 1;
    this.lookback = options.lookback || 3;
    this.tradeAmount = options.tradeAmount || 30;
    this.expirationSize = options.expirationSize || 60;
    if (options.profitPercent) this.profitPercent = options.profitPercent;
  }

  async initialize(env: TradingEnvironmentInterface): Promise<void> {
    // Get balance ID from environment
    this.balanceId = env.getBalanceId();

    // Find profit percent from available assets
    const obs = env.getObservation();
    const asset = obs.state.availableAssets.find(a => a.active_id === this.activeId);
    if (asset && asset.profit_commission > 0) {
      this.profitPercent = 100 - asset.profit_commission;
    }

    // Subscribe to candle sensor for the target asset
    const candleSensorId = SensorManager.candleId(this.activeId, this.candleSize);
    await env.executeActions([
      {
        type: "subscribe",
        payload: {
          id: candleSensorId,
          type: "candle",
          params: { active_id: this.activeId, size: this.candleSize },
        } as Record<string, unknown>,
      },
    ]);

    console.log(`[MomentumAgent] Initialized: activeId=${this.activeId}, lookback=${this.lookback}, tradeAmount=$${this.tradeAmount}`);
  }

  async onObservation(obs: Observation): Promise<Action[]> {
    const sensorId = SensorManager.candleId(this.activeId, this.candleSize);
    const candles = obs.sensors.get(sensorId) as Candle[] | undefined;
    if (!candles || candles.length < this.lookback) return [];

    // Rate limit: one trade per expiration period
    const now = obs.timestamp || Math.floor(Date.now() / 1000);
    if (now - this.lastTradeTime < this.expirationSize) return [];

    // Evaluate momentum
    const recent = candles.slice(-this.lookback);
    const allBullish = recent.every(c => c.close > c.open);
    const allBearish = recent.every(c => c.close < c.open);

    let direction: "call" | "put" | null = null;
    if (allBullish) direction = "call";
    if (allBearish) direction = "put";

    if (!direction) return [];

    this.lastTradeTime = now;
    this.tradeCount++;

    const lastCandle = candles[candles.length - 1]!;
    console.log(
      `\n>>> [TRADE #${this.tradeCount}] ${direction.toUpperCase()} | $${this.tradeAmount} | Expiry: ${this.expirationSize}s`,
    );

    return [
      {
        type: "trade",
        payload: {
          activeId: this.activeId,
          direction,
          price: this.tradeAmount,
          balanceId: this.balanceId,
          expirationSize: this.expirationSize,
          profitPercent: this.profitPercent,
          currentPrice: lastCandle.close,
        } as Record<string, unknown>,
      },
    ];
  }

  onTradeResult(position: Position): void {
    const label = position.close_reason === "win" ? "WIN" : "LOSS";
    console.log(
      `    [RESULT] ${label} | PnL: ${position.pnl} | Direction: ${position.direction}`,
    );
  }
}
