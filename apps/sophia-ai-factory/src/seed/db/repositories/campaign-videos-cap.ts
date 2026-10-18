import { getD1Sync } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface CapResult {
	completedCount: number;
	cap: number;
	creditsPerUnit: number;
}

/**
 * MCU credits per completed video.
 * Derived from BASIC tier: mcuMonthly / campaignsPerMonth = 1000 / 10 = 100
 */
export const CREDITS_PER_VIDEO = 100;

export async function getRefundBadgeCap(campaignId: string): Promise<CapResult> {
	const _db = getD1Sync();
	if (!_db) {
		logger.warn('[campaign-videos-repo] D1 unavailable — cap=0', { campaignId });
		return { completedCount: 0, cap: 0, creditsPerUnit: CREDITS_PER_VIDEO };
	}

	try {
		const db = _db;
		const row = await db
			.prepare(
				`SELECT COUNT(*) AS cnt
				 FROM campaign_videos
				 WHERE campaign_id = ?1
				   AND status = 'completed'
				   AND completed_at IS NOT NULL`,
			)
			.bind(campaignId)
			.first<{ cnt: number }>();
		const completedCount = row?.cnt ?? 0;
		return { completedCount, cap: completedCount * CREDITS_PER_VIDEO, creditsPerUnit: CREDITS_PER_VIDEO };
	} catch (err) {
		logger.warn('[campaign-videos-repo] Cap query failed — returning 0', {
			campaignId,
			error: String(err),
		});
		return { completedCount: 0, cap: 0, creditsPerUnit: CREDITS_PER_VIDEO };
	}
}
