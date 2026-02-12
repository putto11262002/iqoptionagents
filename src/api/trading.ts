import type { Protocol } from "../client/protocol.ts";
import type { IQWebSocket } from "../client/ws.ts";
import type {
  TradeRequest,
  TradeResponse,
  Position,
  Order,
  WsMessage,
} from "../types/index.ts";
import {
  TradeResponseSchema,
  PositionSchema,
  OrderSchema,
  PositionsResponseSchema,
  OrdersResponseSchema,
  HistoryPositionsResponseSchema,
} from "../schemas/index.ts";

export class TradingAPI {
  private positionHandlers: Set<(pos: Position) => void> = new Set();
  private orderHandlers: Set<(order: Order) => void> = new Set();

  constructor(
    private protocol: Protocol,
    private ws: IQWebSocket,
  ) {
    // Listen for position changes
    this.ws.on("portfolio.position-changed", (msg: WsMessage) => {
      const parsed = PositionSchema.safeParse(msg.msg);
      const pos = parsed.success ? parsed.data : msg.msg as Position;
      if (!parsed.success) {
        console.warn("[TradingAPI] Position schema warning:", parsed.error.issues);
      }
      for (const handler of this.positionHandlers) {
        handler(pos);
      }
    });

    // Listen for order changes
    this.ws.on("portfolio.order-changed", (msg: WsMessage) => {
      const parsed = OrderSchema.safeParse(msg.msg);
      const order = parsed.success ? parsed.data : msg.msg as Order;
      if (!parsed.success) {
        console.warn("[TradingAPI] Order schema warning:", parsed.error.issues);
      }
      for (const handler of this.orderHandlers) {
        handler(order);
      }
    });
  }

  /** Place a blitz option trade */
  async buyBlitzOption(req: TradeRequest): Promise<TradeResponse> {
    const serverTime = this.ws.serverTime
      ? Math.floor(this.ws.serverTime / 1000)
      : Math.floor(Date.now() / 1000);

    const expired = serverTime + req.expirationSize;
    const value = req.currentPrice
      ? Math.round(req.currentPrice * 1000000)
      : 0;
    const profitPercent = req.profitPercent || 80;

    const res = await this.protocol.sendMessage(
      "binary-options.open-option",
      "2.0",
      {
        user_balance_id: req.balanceId,
        active_id: req.activeId,
        option_type_id: 12, // blitz option
        direction: req.direction,
        expired,
        refund_value: 0,
        price: req.price,
        value,
        profit_percent: profitPercent,
        expiration_size: req.expirationSize,
      },
    );

    if (res.status && res.status !== 2000) {
      throw new Error(
        `Trade failed (status ${res.status}): ${JSON.stringify(res.msg)}`,
      );
    }

    const parsed = TradeResponseSchema.safeParse(res.msg);
    if (!parsed.success) {
      console.warn("[TradingAPI] TradeResponse schema warning:", parsed.error.issues);
      return res.msg as TradeResponse;
    }
    return parsed.data;
  }

  /** Subscribe to position changes for real-time trade updates */
  subscribePositions(
    userId: number,
    balanceId: number,
    handler: (pos: Position) => void,
  ): void {
    this.positionHandlers.add(handler);

    this.protocol.subscribe("portfolio.position-changed", "3.0", {
      user_id: userId,
      user_balance_id: balanceId,
      instrument_type: "blitz-option",
    });
  }

  /** Subscribe to order changes */
  subscribeOrders(userId: number, handler: (order: Order) => void): void {
    this.orderHandlers.add(handler);

    this.protocol.subscribe("portfolio.order-changed", "2.0", {
      user_id: userId,
      instrument_type: "blitz-option",
    });
  }

  /** Get open positions, validated through PositionsResponseSchema */
  async getPositions(
    balanceId: number,
    instrumentTypes = ["blitz-option"],
  ): Promise<Position[]> {
    const res = await this.protocol.sendMessage(
      "portfolio.get-positions",
      "4.0",
      {
        user_balance_id: balanceId,
        instrument_types: instrumentTypes,
      },
    );
    const parsed = PositionsResponseSchema.safeParse(res.msg);
    if (parsed.success) return parsed.data.positions;

    console.warn("[TradingAPI] PositionsResponse schema warning:", parsed.error.issues);
    const msg = res.msg as Record<string, unknown>;
    return (msg.positions || []) as Position[];
  }

  /** Get pending orders, validated through OrdersResponseSchema */
  async getOrders(
    balanceId: number,
    instrumentTypes = ["blitz-option"],
  ): Promise<Order[]> {
    const res = await this.protocol.sendMessage(
      "portfolio.get-orders",
      "2.0",
      {
        user_balance_id: balanceId,
        instrument_types: instrumentTypes,
      },
    );
    const parsed = OrdersResponseSchema.safeParse(res.msg);
    if (parsed.success) return parsed.data.orders;

    console.warn("[TradingAPI] OrdersResponse schema warning:", parsed.error.issues);
    const msg = res.msg as Record<string, unknown>;
    return (msg.orders || []) as Order[];
  }

  /** Get closed trade history, validated through HistoryPositionsResponseSchema */
  async getHistoryPositions(
    balanceId: number,
    instrumentTypes = ["blitz-option"],
    limit = 50,
    offset = 0,
  ): Promise<Position[]> {
    const res = await this.protocol.sendMessage(
      "portfolio.get-history-positions",
      "1.0",
      {
        user_balance_id: balanceId,
        instrument_types: instrumentTypes,
        limit,
        offset,
      },
    );
    const parsed = HistoryPositionsResponseSchema.safeParse(res.msg);
    if (parsed.success) return parsed.data.positions;

    console.warn("[TradingAPI] HistoryPositionsResponse schema warning:", parsed.error.issues);
    const msg = res.msg as Record<string, unknown>;
    return (msg.positions || []) as Position[];
  }

  onPositionChanged(handler: (pos: Position) => void): void {
    this.positionHandlers.add(handler);
  }

  offPositionChanged(handler: (pos: Position) => void): void {
    this.positionHandlers.delete(handler);
  }
}
