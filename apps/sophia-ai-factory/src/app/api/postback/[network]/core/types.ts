import { z } from 'zod';

// Known postback-capable networks (allowlist)
export const KNOWN_NETWORKS = new Set([
  'binance-link',
  'binance',
  'bybit',
  'bitget',
  'okx',
  'partnerstack',
  'rewardful',
  'impact',
  'cj',
  'awin',
  'clickbank',
  'tiktok_shop',
  'generic',
]);

export const PostbackSchema = z.object({
  link_id: z.string().min(8).max(8),
  external_id: z.string().optional(),
  amount_usd: z.number().optional(),
});

export type PostbackPayload = z.infer<typeof PostbackSchema>;
