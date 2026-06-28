import { serve } from "inngest/next";
import { inngest } from "@/forest/inngest/client";
import {
  helloWorld,
  generateCampaign,
  autoDiscoverAffiliates,
  publishExecute,
  publishTokenRefreshCron,
  conversionToLedger,
  pendingPromoterCron,
  payoutBatcher,
  reconciliationCron,
  offerSyncCron,
  storageTrackerDaily,
  accountDeleteFinalizeCron,
  videoGenerate,
  batchVideoFanout,
  repurposeAnalyze,
  repurposeClipGenerate,
  analyticsSync,
  tokenRefreshCron,
  thumbnailAbSelector,
  sopExecute,
} from "@/forest/inngest/functions/index";

// Deprecated handlers (Phase 06 video_jobs chain + URL-to-Revenue) removed from
// serve registration on 2026-05-17 per ADR 0007: the underlying `video_jobs`
// table was never applied to prod D1, so the chain has been silent-failing
// since inception. Canonical video pipeline is HeyGen webhook → `videos`
// table via `lib/fulfillment/complete-video-from-webhook.ts`.

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    helloWorld,
    generateCampaign,
    autoDiscoverAffiliates,
    // Publishing pipeline (Phase 10)
    publishExecute,
    publishTokenRefreshCron,
    // Payout pipeline (Phase 13)
    conversionToLedger,
    pendingPromoterCron,
    payoutBatcher,
    reconciliationCron,
    // Cron jobs previously defined but missing from registration
    offerSyncCron,
    storageTrackerDaily,
    // Wave 22 P06: auto-finalize account deletion after cooldown
    accountDeleteFinalizeCron,
    // Newly registered active functions
    videoGenerate,
    batchVideoFanout,
    repurposeAnalyze,
    repurposeClipGenerate,
    analyticsSync,
    tokenRefreshCron,
    thumbnailAbSelector,
    // SOP execution engine (Phase 01 Solo SOPs)
    sopExecute,
  ],
});
