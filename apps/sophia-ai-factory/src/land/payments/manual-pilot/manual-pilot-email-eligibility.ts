import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { failure, success } from '@/seed/types/result';
import { manualPilotCalendarDeadlineMs } from './manual-pilot-delivery-evidence';

export const emailReviewSelectionSchema = z.object({
  reviewId: z.string().trim().min(5).max(128),
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
}).strict();

/** Policy calculation only. Callers must establish receiver provenance separately. */
export function assessEmailReceiptWindow(input: {
  activatedAt: string; receivedAt: string | null; category: 'goodwill_7d' | 'delivery_failure_14d';
  receiverAuthoritative: boolean; deliveryFailureVerified: boolean;
}) {
  const activated = Date.parse(input.activatedAt);
  const received = input.receivedAt ? Date.parse(input.receivedAt) : NaN;
  if (!input.receiverAuthoritative || !Number.isFinite(activated) || !Number.isFinite(received)
    || received < activated) return 'PENDING_MANUAL_REVIEW' as const;
  const days = input.category === 'goodwill_7d' ? 7 : 14;
  if (received > manualPilotCalendarDeadlineMs(activated, days)) return 'INELIGIBLE_OUTSIDE_WINDOW' as const;
  if (input.category === 'delivery_failure_14d' && !input.deliveryFailureVerified) return 'PENDING_MANUAL_REVIEW' as const;
  return 'ELIGIBLE_TIMELY' as const;
}

/** No authoritative mailbox receiver is configured. Uploaded headers and operator
 * assertions cannot supply that authority, even when preserved immutably. */
export async function reviewEmailReceiptAuthority(db: D1Database, input: unknown, adminId: string) {
  const parsed = emailReviewSelectionSchema.safeParse(input);
  if (!parsed.success || !adminId) return failure({ code: 'VALIDATION_ERROR', message: 'Valid review selection required' });
  try {
    const row = await db.prepare(`SELECT id FROM manual_pilot_email_receipt_reviews
      WHERE id=? AND order_id=? AND org_id=?
      AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
      .bind(parsed.data.reviewId, parsed.data.orderId, parsed.data.orgId, adminId).first<{ id: string }>();
    if (!row) return failure({ code: 'NOT_FOUND', message: 'Authorized review not found' });
    return success({ reviewId: row.id, eligibilityOutcome: 'PENDING_MANUAL_REVIEW' as const,
      blockedReason: 'AUTHORITATIVE_RECEIVER_UNAVAILABLE' as const });
  } catch { return failure({ code: 'DB_ERROR', message: 'Unable to resolve email receipt review' }); }
}
