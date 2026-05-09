import { serve } from "inngest/next";
import { inngest } from "@/forest/inngest/client";
import {
  helloWorld,
  generateCampaign,
  autoDiscoverAffiliates,
  videoScripting,
  videoTTS,
  videoVisual,
  videoCompose,
  videoUpload,
  videoPublish,
  publishExecute,
  publishTokenRefreshCron,
  conversionToLedger,
  pendingPromoterCron,
  payoutBatcher,
  reconciliationCron,
  urlRevenueVideoHandler,
  offerSyncCron,
  storageTrackerDaily,
} from "@/forest/inngest/functions/index";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    helloWorld,
    generateCampaign,
    autoDiscoverAffiliates,
    // Video pipeline (Phase 06)
    videoScripting,
    videoTTS,
    videoVisual,
    videoCompose,
    videoUpload,
    videoPublish,
    // Publishing pipeline (Phase 10)
    publishExecute,
    publishTokenRefreshCron,
    // Payout pipeline (Phase 13)
    conversionToLedger,
    pendingPromoterCron,
    payoutBatcher,
    reconciliationCron,
    // URL-to-Revenue (Phase 3 wiring)
    urlRevenueVideoHandler,
    // Cron jobs previously defined but missing from registration
    offerSyncCron,
    storageTrackerDaily,
  ],
});
