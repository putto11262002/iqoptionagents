import { z } from "zod";

/** Raw candle data from IQ Option with `low`/`high` aliases for `min`/`max` */
export const CandleSchema = z
  .object({
    id: z.number(),
    from: z.number(),
    to: z.number(),
    open: z.number(),
    close: z.number(),
    min: z.number(),
    max: z.number(),
    volume: z.number(),
    active_id: z.number(),
    size: z.number(),
    at: z.number(),
    phase: z.string().optional(),
    ask: z.number().optional(),
    bid: z.number().optional(),
    min_at: z.number().optional(),
    max_at: z.number().optional(),
  })
  .transform((c) => ({
    ...c,
    /** Alias for `min` — the lowest price in this candle */
    low: c.min,
    /** Alias for `max` — the highest price in this candle */
    high: c.max,
  }));

export type Candle = z.infer<typeof CandleSchema>;

/** Wrapper for historical candles response from `get-candles` */
export const CandlesResponseSchema = z.object({
  candles: z.array(CandleSchema),
});

export type CandlesResponse = z.infer<typeof CandlesResponseSchema>;
