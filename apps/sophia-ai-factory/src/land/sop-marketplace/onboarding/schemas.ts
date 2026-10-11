import { z } from 'zod';
import type { CreatorProfile } from '@/seed/db/marketplace-ops';
import type { CreatorProfileView } from './types';

/** Map a DB CreatorProfile (snake_case) to a public CreatorProfileView (camelCase). */
export function toView(profile: CreatorProfile): CreatorProfileView {
  return {
    id: profile.id,
    userId: profile.user_id,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    payoutMethod: profile.payout_method,
    payoutAddress: profile.payout_address,
    totalEarningsCents: profile.total_earnings_cents,
    totalPaidCents: profile.total_paid_cents,
    status: profile.status,
    createdAt: profile.created_at,
  };
}

export const registerSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  payoutMethod: z.enum(['nowpayments', 'stripe_connect', 'usdt']),
  payoutAddress: z.string().min(1, 'Payout address is required').max(256),
  inviteCode: z.string().max(20).optional(),
});

export const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  payoutMethod: z.enum(['nowpayments', 'stripe_connect', 'usdt']).optional(),
  payoutAddress: z.string().min(1).max(256).optional(),
});
