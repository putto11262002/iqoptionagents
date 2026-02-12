import { z } from "zod";

/** User profile information returned by IQ Option */
export const ProfileSchema = z
  .object({
    user_id: z.number(),
    email: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    nickname: z.string().default(""),
    currency_id: z.number().optional(),
    balance_id: z.number(),
    balance: z.number(),
    currency: z.string(),
    account_status: z.string().optional(),
  })
  .passthrough();

/** Balance entry for a user account */
export const BalanceSchema = z
  .object({
    id: z.number(),
    user_id: z.number(),
    type: z.number(),
    amount: z.number(),
    currency: z.string(),
    is_fiat: z.boolean(),
    enrolled_amount: z.number().optional(),
  })
  .passthrough();

/** Real-time balance change event pushed after trades */
export const BalanceChangedSchema = z
  .object({
    current_balance: z.object({
      id: z.number(),
      amount: z.number(),
      currency: z.string(),
      type: z.number(),
    }).passthrough(),
  })
  .passthrough();

export type Profile = z.infer<typeof ProfileSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type BalanceChanged = z.infer<typeof BalanceChangedSchema>;
