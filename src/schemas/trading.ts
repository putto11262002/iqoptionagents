import { z } from "zod";
import type { Candle } from "./candles.ts";

/** Request payload for placing a binary option trade */
export const TradeRequestSchema = z.object({
  activeId: z.number(),
  direction: z.enum(["call", "put"]),
  price: z.number(),
  balanceId: z.number(),
  expirationSize: z.number(),
  profitPercent: z.number().optional(),
  currentPrice: z.number().optional(),
});

/** Server response after placing a trade */
export const TradeResponseSchema = z.object({
  user_id: z.number(),
  id: z.number(),
  price: z.number(),
  exp: z.number(),
  created: z.number(),
  type: z.string(),
  act: z.number(),
  direction: z.string(),
  value: z.number(),
  profit_income: z.number(),
  profit_return: z.number(),
  rollover_params: z
    .object({
      amount_multiplier: z.number(),
      max_count: z.number(),
      offset: z.number(),
      deadtime: z.number(),
    })
    .optional(),
});

/**
 * An open or closed trading position.
 *
 * Two formats exist:
 * - Real-time (position-changed): id is number, direction at top level
 * - History (get-history-positions): id is string hash, direction inside raw_event
 */
export const PositionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  instrument_type: z.string(),
  instrument_id: z.string(),
  user_id: z.number(),
  user_balance_id: z.number(),
  active_id: z.number(),
  direction: z.string().optional(),          // missing in history format
  open_time: z.number(),
  close_time: z.number().optional(),
  open_quote: z.number(),
  close_quote: z.number().optional(),
  invest: z.number(),
  pnl: z.number(),
  pnl_realized: z.number(),
  status: z.enum(["open", "closed"]),
  close_reason: z.enum(["win", "loose"]).nullable().optional(),
  close_profit: z.number().optional(),
  expiration_value: z.number().optional(),
  expiration_time: z.number().optional(),
  expiration_size: z.number().optional(),
  result: z.enum(["opened", "win", "loose"]).optional(),
  profit_amount: z.number().nullable().optional(),
  // History-only fields
  source: z.string().optional(),
  external_id: z.number().optional(),
  platform_id: z.number().optional(),
  pnl_net: z.number().optional(),
  swap: z.number().optional(),
  raw_event: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

/** A pending or filled order */
export const OrderSchema = z.object({
  id: z.number(),
  instrument_type: z.string(),
  user_id: z.number(),
  user_balance_id: z.number(),
  active_id: z.number(),
  direction: z.string(),
  status: z.string(),
  price: z.number(),
});

/** Trading signal direction */
export const SignalSchema = z.enum(["call", "put"]).nullable();

/** Context passed to a trading strategy for signal generation */
export const StrategyContextSchema = z.object({
  candles: z.array(z.custom<Candle>()),
  tradersMood: z.number().optional(),
  currentPrice: z.number(),
  activeId: z.number(),
});

/** Response wrapper for `portfolio.get-positions` */
export const PositionsResponseSchema = z.object({
  positions: z.array(PositionSchema),
  total: z.number().optional(),
  limit: z.number().optional(),
});

/** Response wrapper for `portfolio.get-orders` */
export const OrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
});

/** Response wrapper for `portfolio.get-history-positions` */
export const HistoryPositionsResponseSchema = z.object({
  positions: z.array(PositionSchema),
  limit: z.number().optional(),
});

export type TradeRequest = z.infer<typeof TradeRequestSchema>;
export type TradeResponse = z.infer<typeof TradeResponseSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type StrategyContext = z.infer<typeof StrategyContextSchema>;
export type PositionsResponse = z.infer<typeof PositionsResponseSchema>;
export type OrdersResponse = z.infer<typeof OrdersResponseSchema>;
export type HistoryPositionsResponse = z.infer<typeof HistoryPositionsResponseSchema>;
