/**
 * Read-only query and recalculation helpers for campaign refund badge caps.
 * @module land/billing/refund-badge-cap-queries
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getRefundBadgeCap } from '@/seed/db/repositories/campaign-videos-repo';
import { toError } from '@/seed/utils/to-error';

export type CapWriteOutcome =
  | { kind: 'written_full'; writtenCents: number; capInfo: { completedCount: number; cap: number } }
  | { kind: 'written_clamped'; writtenCents: number; capInfo: { completedCount: number; cap: number } }
  | { kind: 'not_written'; reason: string };

export interface WriteRefundBadgeInput {
  /** Target campaign row. */
  campaignId: string;
  /** Requested badge amount in cents. Will be clamped to cap. */
  requestedCents: number;
}

/**
 * Recalculate and re-apply the cap for a campaign.
 * Reads campaigns.refund_badge_cents, computes new cap, writes back
 * only if the cap is lower than current (never inflates).
 */
export async function recalculateRefundBadgeCap(campaignId: string): Promise<CapWriteOutcome> {
  const db = createServerClient();

  try {
    const current = await db
      .prepare('SELECT refund_badge_cents FROM campaigns WHERE id = ?1')
      .bind(campaignId)
      .first<{ refund_badge_cents: number }>();

    if (!current) {
      return { kind: 'not_written', reason: 'campaign not found' };
    }

    const capInfo = await getRefundBadgeCap(campaignId);
    const clamped = Math.min(current.refund_badge_cents, capInfo.cap);

    if (clamped === current.refund_badge_cents) {
      return { kind: 'written_full', writtenCents: clamped, capInfo };
    }

    db.prepare(
      `UPDATE campaigns
       SET refund_badge_cents = ?1,
           refund_badge_updated_at = ?2
       WHERE id = ?3`,
    )
      .bind(clamped, new Date().toISOString(), campaignId)
      .run();

    logger.info('[refund-badge-cap] Badge recalculated (reduced)', {
      campaignId,
      previous: current.refund_badge_cents,
      new: clamped,
      cap: capInfo.cap,
    });

    return { kind: 'written_clamped', writtenCents: clamped, capInfo };
  } catch (err) {
    logger.error('[refund-badge-cap] Recalculation failed', toError(err), { campaignId });
    return { kind: 'not_written', reason: toError(err).message };
  }
}

/**
 * Get current cap info without writing.
 * Useful for displaying "you can earn up to X more credits" in the UI.
 */
export async function getCurrentRefundBadgeCap(campaignId: string): Promise<{
  completedCount: number;
  capCents: number;
  remainingCents: number;
  currentBadgeCents: number;
}> {
  const db = createServerClient();

  try {
    const campaign = await db
      .prepare('SELECT refund_badge_cents FROM campaigns WHERE id = ?1')
      .bind(campaignId)
      .first<{ refund_badge_cents: number }>();

    const capInfo = await getRefundBadgeCap(campaignId);
    const currentBadge = campaign?.refund_badge_cents ?? 0;

    return {
      completedCount: capInfo.completedCount,
      capCents: capInfo.cap,
      remainingCents: Math.max(0, capInfo.cap - currentBadge),
      currentBadgeCents: currentBadge,
    };
  } catch {
    return { completedCount: 0, capCents: 0, remainingCents: 0, currentBadgeCents: 0 };
  }
}
