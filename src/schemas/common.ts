import { z } from "zod";

/** Envelope for incoming WebSocket messages from IQ Option server */
export const WsMessageSchema = z.object({
  name: z.string(),
  request_id: z.string().optional(),
  msg: z.unknown(),
  local_time: z.number().optional(),
  status: z.number().optional(),
});

/** Body structure for outgoing WebSocket send messages */
export const SendMessageBodySchema = z.object({
  name: z.string(),
  version: z.string(),
  body: z.record(z.string(), z.unknown()),
});

/** Structure for WebSocket subscription messages */
export const SubscribeMessageSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type WsMessage = z.infer<typeof WsMessageSchema>;
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
export type SubscribeMessage = z.infer<typeof SubscribeMessageSchema>;
