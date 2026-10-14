/**
 * refund-badge-cap.ts
 *
 * Hard-cap enforcement for the campaign refund badge.
 * Formula: cap_cents = COUNT(campaign_videos WHERE status='completed') × CREDITS_PER_VIDEO
 * Enforcement rule (write-time clamp, no DB triggers):
 * refund_badge_cents_written = MIN(requested_cents, cap_cents)
 *
 * @module billing/refund-badge-cap
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getRefundBadgeCap, CREDITS_PER_VIDEO } from '@/seed/db/repositories/campaign-videos-repo';
import { toError } from '@/seed/utils/to-error';
import {
  recalculateRefundBadgeCap,
  getCurrentRefundBadgeCap,
  type CapWriteOutcome,
  type WriteRefundBadgeInput,
} from './refund-badge-cap-queries';

export {
  recalculateRefundBadgeCap,
  getCurrentRefundBadgeCap,
  type CapWriteOutcome,
  type WriteRefundBadgeInput,
} from './refund-badge-cap-queries';

/**
 * Enforce the refund badge hard cap on a campaigns row.
 * Throws: never. All errors are caught and returned as { kind: 'not_written' }.
 */
export async function enforceRefundBadgeCap(input: WriteRefundBadgeInput): Promise<CapWriteOutcome> {
  if (input.requestedCents <= 0) {
    return { kind: 'not_written', reason: 'requestedCents is zero or negative' };
  }

  let capInfo: { completedCount: number; cap: number };
  try {
    capInfo = await getRefundBadgeCap(input.campaignId);
  } catch (err) {
    logger.error('[refund-badge-cap] Cap query failed', toError(err), {
      campaignId: input.campaignId,
    });
    return { kind: 'not_written', reason: `cap query failed: ${toError(err).message}` };
  }

  const clamped = Math.min(input.requestedCents, capInfo.cap);
  if (clamped <= 0) {
    return {
      kind: 'not_written',
      reason: `cap is 0 (completedCount=${capInfo.completedCount}, creditsPerUnit=${CREDITS_PER_VIDEO})`,
    };
  }

  try {
    const db = createServerClient();
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE campaigns
       SET refund_badge_cents = ?1,
           refund_badge_updated_at = ?2
       WHERE id = ?3`,
    )
      .bind(clamped, now, input.campaignId)
      .run();

    const outcome: CapWriteOutcome =
      clamped >= input.requestedCents
        ? { kind: 'written_full', writtenCents: clamped, capInfo }
        : { kind: 'written_clamped', writtenCents: clamped, capInfo };

    logger.info('[refund-badge-cap] Badge written', {
      campaignId: input.campaignId,
      requested: input.requestedCents,
      written: clamped,
      cap: capInfo.cap,
      completedCount: capInfo.completedCount,
      kind: outcome.kind,
    });

    return outcome;
  } catch (err) {
    logger.error('[refund-badge-cap] Write failed', toError(err), {
      campaignId: input.campaignId,
    });
    return { kind: 'not_written', reason: `write failed: ${toError(err).message}` };
  }
}
