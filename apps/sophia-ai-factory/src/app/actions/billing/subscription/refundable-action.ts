'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { queryRefundablePurchases } from '@/land/billing';
import type { RefundablePurchase } from './types';

/**
 * Returns user's one-time purchases eligible for refund.
 *
 * Eligibility:
 * - Within 30-day refund window
 * - Status = 'paid'
 * - No existing refund request
 *
 * Used by billing page to show refundable purchases.
 */
export async function listRefundablePurchasesAction(): Promise<RefundablePurchase[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return queryRefundablePurchases(user.id);
}
