/**
 * Inngest Functions — barrel re-export
 */

export { helloWorld } from './hello-world';
export { generateCampaign } from './generate-campaign';
export { autoDiscoverAffiliates } from './auto-discover-affiliates';

// ── DEPRECATED: Phase 06 video_jobs chain ────────────────────────────────────
// Removed from serve() registration on 2026-05-17 per ADR 0007.
// Underlying `video_jobs` table was never applied to prod D1.
// These exports are retained only for backwards compatibility; they have
// ZERO consumers as of 2026-05-30. Safe to delete after 2026-06-30.
// @deprecated — use HeyGen webhook → `videos` table pipeline instead.
export { videoScripting } from './video-scripting';
export { videoTTS } from './video-tts';
export { videoVisual } from './video-visual';
export { videoCompose } from './video-compose';
export { videoUpload } from './video-upload';
export { videoPublish } from './video-publish';

// Publishing pipeline functions (Phase 10)
export { publishExecute, publishTokenRefreshCron } from './publish-execute';

// Affiliate offer sync cron (Phase 09)
export { offerSyncCron } from '@/forest/jobs/offer-sync-cron';

// Payout pipeline functions (Phase 13)
export { conversionToLedger } from './conversion-to-ledger';
export { pendingPromoterCron } from '@/forest/jobs/pending-promoter-cron';
export { payoutBatcher } from '@/forest/jobs/payout-batcher';
export { reconciliationCron } from '@/forest/jobs/reconciliation';

// Phase 11: storage tracker cron
export { storageTrackerDaily } from '@/forest/quota/storage-tracker-cron';

// ── DEPRECATED: URL-to-Revenue video handler ─────────────────────────────────
// Depends on Phase 06 video_jobs chain which was never applied to prod D1.
// Removed from serve() registration on 2026-05-17 per ADR 0007.
// ZERO consumers as of 2026-05-30. Safe to delete after 2026-06-30.
// @deprecated
export { urlRevenueVideoHandler } from './url-revenue-video-handler';

// Wave 13 I2: Mission video generation
export { videoGenerate } from './video-generate';

// Wave 22 P06: auto-finalize account deletion after 7d cooldown
export { accountDeleteFinalizeCron } from './account-delete-finalize-cron';

// SOP execution engine (Phase 01 Solo SOPs)
export { sopExecute } from '@/forest/sops/sop-executor';

// Video Factory v2: Batch video generation fanout
export { batchVideoFanout } from './batch-video-fanout';

// Phase 03: Auto-repurpose
export { repurposeAnalyze } from './repurpose-analyze';
export { repurposeClipGenerate } from './repurpose-clip-generate';

// Phase 05: Per-video analytics sync cron
export { analyticsSync } from './analytics-sync';

// Phase 06: Token refresh cron (TikTok/Instagram/YouTube)
export { tokenRefreshCron } from './token-refresh-cron';

// Phase 07: Thumbnail A/B selector cron
export { thumbnailAbSelector } from './thumbnail-ab-selector';
