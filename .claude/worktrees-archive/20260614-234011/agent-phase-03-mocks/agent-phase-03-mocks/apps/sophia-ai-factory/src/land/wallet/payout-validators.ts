/**
 * Payout Validators
 * Zod schemas + threshold constants for payout endpoints.
 */

import { z } from 'zod';

/** Minimum payout threshold in USD — reduces admin overhead */
export const MIN_PAYOUT_USD = 50;

/** Payout methods supported in MVP */
export const PAYOUT_METHODS = ['usdt_trc20', 'usdt_erc20', 'bank_transfer', 'other'] as const;
export type PayoutMethod = typeof PAYOUT_METHODS[number];

/** Query schema for GET /api/admin/payouts/queue */
export const QueueQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
  cursor: z.string().optional(),
});

/** Body schema for POST /api/admin/payouts/mark-paid */
// userId: Better Auth generates lower(hex(randomblob(16))) — 32-char hex, NOT standard UUID.
// Using min(1).max(64) to accommodate any ID format the auth layer produces.
export const MarkPaidSchema = z.object({
  userId: z.string().min(1).max(64),
  amount: z.number().positive(),
  method: z.enum(PAYOUT_METHODS),
  reference: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
});

export type QueueQuery = z.infer<typeof QueueQuerySchema>;
export type MarkPaidBody = z.infer<typeof MarkPaidSchema>;
