/**
 * Promo Redeem Free Request Schemas & Types
 *
 * Layer: app/api/promo/redeem-free/service
 */

import { z } from 'zod';

export const redeemFreeSchema = z.object({
  code: z.string().min(1).max(30),
  email: z.string().email(),
  fullName: z.string().min(1).max(100).optional(),
  agencyType: z.string().optional(),
  tier: z.string().optional(),
  locale: z.string().optional(),
});

export type RedeemFreeInput = z.infer<typeof redeemFreeSchema>;

export interface ResolvedUser {
  userId: string | null;
  sessionEmailVerified: boolean;
}
