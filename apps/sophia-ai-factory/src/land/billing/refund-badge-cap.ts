/**
 * refund-badge-cap.ts
 *
 * Hard-cap enforcement for the campaign refund badge.
 *
 * Formula: cap_cents = COUNT(campaign_videos WHERE status='completed') × CREDITS_PER_VIDEO
 *
 * Enforcement rule (write-time clamp, no DB triggers):
 * refund_badge_cents_written = MIN(requested_cents, cap_cents)
 *
 * This module is pure-billing: it lives in land/billing/ per the 4-layer
 * architecture rule that financial authority belongs to land, not forest.
 *
 * @module billing/refund-badge-cap
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getRefundBadgeCap, CREDITS_PER_VIDEO } from '@/seed/db/repositories/campaign-videos-repo';
import { toError } from '@/seed/utils/to-error';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * When a cap-enforced write is requested, the result discriminates
 * between "wrote at full amount", "wrote at cap (clamped)", and failures.
 */
export type CapWriteOutcome =
	| { kind: 'written_full'; writtenCents: number; capInfo: { completedCount: number; cap: number } }
	| { kind: 'written_clamped'; writtenCents: number; capInfo: { completedCount: number; cap: number } }
	| { kind: 'not_written'; reason: string };

/** Input for a cap-enforced refund badge write. */
export interface WriteRefundBadgeInput {
	/** Target campaign row. */
	campaignId: string;
	/** Requested badge amount in cents. Will be clamped to cap. */
	requestedCents: number;
}

// ── Cap enforcement ───────────────────────────────────────────────────────────

/**
 * Enforce the refund badge hard cap on a campaigns row.
 *
 * Behavior:
 * 1. Reads the live cap from campaign_videos (COUNT of completed rows × CREDITS_PER_VIDEO).
 * 2. Computes clamped = MIN(requested, cap).
 * 3. Writes clamped to campaigns.refund_badge_cents.
 * 4. Updates refund_badge_updated_at.
 *
 * Returns the outcome so callers can distinguish:
 * - User got the full badge (completedCount >= requested / CREDITS_PER_VIDEO)
 * - User got a partial badge (still earning via more video completions)
 *
 * Throws: never. All errors are caught and returned as { kind: 'not_written' }.
 */
export async function enforceRefundBadgeCap(input: WriteRefundBadgeInput): Promise<CapWriteOutcome> {
	if (input.requestedCents <= 0) {
		return { kind: 'not_written', reason: 'requestedCents is zero or negative' };
	}

	// ── 1. Compute cap ────────────────────────────────────────────────────────
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

	// ── 2. Write clamped value ────────────────────────────────────────────────
	try {
		const db = createServerClient();
		const now = new Date().toISOString();

		db.prepare(
			`UPDATE campaigns
			 SET refund_badge_cents = ?1,
			     refund_badge_updated_at = ?2
			 WHERE id = ?3`,
		).bind(clamped, now, input.campaignId).run();

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

/**
 * Recalculate and re-apply the cap for a campaign.
 * Use this when something external changed (e.g., videos failed and
 * need to reduce an already-written badge).
 *
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
