// Bridge file — re-exports all types from Zod schemas (single source of truth)
// Existing imports like `from "../types/index.ts"` continue to work.

export type {
  WsMessage,
  SendMessageBody,
  SubscribeMessage,
  Profile,
  Balance,
  BalanceChanged,
  Active,
  ActiveInfo,
  BlitzOptionConfig,
  Candle,
  CandlesResponse,
  TradeRequest,
  TradeResponse,
  Position,
  Order,
  Signal,
  StrategyContext,
  PositionsResponse,
  OrdersResponse,
  HistoryPositionsResponse,
  TradersMood,
} from "../schemas/index.ts";

// Re-export RoutingFilters as a simple type (not in schemas since it's just a helper)
export interface RoutingFilters {
  [key: string]: unknown;
}
