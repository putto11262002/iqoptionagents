import { z } from "zod";

/** Traders mood (sentiment) data for an asset */
export const TradersMoodSchema = z.object({
  asset_id: z.number(),
  value: z.number(),
  instrument_type: z.string().optional(),
  instrument: z.string().optional(),
});

export type TradersMood = z.infer<typeof TradersMoodSchema>;
