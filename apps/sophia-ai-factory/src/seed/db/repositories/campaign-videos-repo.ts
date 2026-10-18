import { getD1Sync } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
	type CapResult,
	CREDITS_PER_VIDEO,
	getRefundBadgeCap,
} from './campaign-videos-cap';

export type { CapResult };
export { CREDITS_PER_VIDEO, getRefundBadgeCap };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CampaignVideoRow {
	id: string;
	campaign_id: string;
	status: 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled';
	video_url: string | null;
	error_message: string | null;
	cost_cents: number;
	created_at: string;
	completed_at: string | null;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Insert a queued row. Returns generated id or null on failure. */
export function insertCampaignVideo(
	campaignId: string,
	options?: { videoUrl?: string; costCents?: number },
): string | null {
	const _db = getD1Sync();
	if (!_db) {
		logger.warn('[campaign-videos-repo] D1 unavailable — insert skipped', { campaignId });
		return null;
	}
	const db = _db;
	const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
	db.prepare(
		`INSERT INTO campaign_videos (id, campaign_id, status, video_url, cost_cents)
		 VALUES (?1, ?2, 'queued', ?3, ?4)`,
	)
		.bind(id, campaignId, options?.videoUrl ?? null, options?.costCents ?? 0)
		.run();
	logger.info('[campaign-videos-repo] Inserted campaign_video', { id, campaignId });
	return id;
}

/** Mark a campaign_video as completed. */
export function markCampaignVideoCompleted(
	videoId: string,
	videoUrl: string,
	costCents?: number,
): void {
	const _db = getD1Sync();
	if (!_db) return;
	const db = _db;
	db.prepare(
		`UPDATE campaign_videos
		 SET status = 'completed',
		     video_url = ?1,
		     cost_cents = COALESCE(?2, cost_cents),
		     completed_at = datetime('now')
		 WHERE id = ?3`,
	)
		.bind(videoUrl, costCents ?? null, videoId)
		.run();
	logger.info('[campaign-videos-repo] Marked video completed', { videoId });
}

/** Mark a campaign_video as failed. */
export function markCampaignVideoFailed(videoId: string, errorMessage: string): void {
	const _db = getD1Sync();
	if (!_db) return;
	const db = _db;
	db.prepare(
		`UPDATE campaign_videos
		 SET status = 'failed',
		     error_message = ?1,
		     completed_at = datetime('now')
		 WHERE id = ?2`,
	)
		.bind(errorMessage, videoId)
		.run();
	logger.warn('[campaign-videos-repo] Marked video failed', { videoId, error: errorMessage });
}

/** Cancel all pending videos for a campaign. Returns count cancelled. */
export async function cancelPendingCampaignVideos(campaignId: string): Promise<number> {
	const _db = getD1Sync();
	if (!_db) return 0;
	const db = _db;
	const result = await db
		.prepare(
			`UPDATE campaign_videos
			 SET status = 'cancelled', completed_at = datetime('now')
			 WHERE campaign_id = ?1 AND status IN ('queued', 'generating')`,
		)
		.bind(campaignId)
		.run();
	return result.meta?.changes ?? 0;
}

/** List all videos for a campaign, ordered by created_at. */
export async function getCampaignVideos(campaignId: string): Promise<CampaignVideoRow[]> {
	const _db = getD1Sync();
	if (!_db) return [];
	const db = _db;
	const result = await db
		.prepare(
			`SELECT id, campaign_id, status, video_url, error_message, cost_cents,
			        created_at, completed_at
			 FROM campaign_videos
			 WHERE campaign_id = ?1
			 ORDER BY created_at ASC`,
		)
		.bind(campaignId)
		.all<CampaignVideoRow>();
	return result.results ?? [];
}
