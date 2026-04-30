import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
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
} from "@/lib/inngest/functions/index";

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
  ],
});
