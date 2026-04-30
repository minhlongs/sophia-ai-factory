import { Inngest, EventSchemas } from "inngest";
import { Tier } from "@/types";

type CampaignCreatedEvent = {
  data: {
    campaignId: string;
    userId: string;
    topic: string;
    audience: string;
    tier: Tier;
    resume?: boolean;
    resumeFrom?: "script" | "tts" | "video" | "finalize";
  };
};

type VideoJobPayload = {
  data: {
    jobId: string;
    tenantId: string;
    userId: string;
  };
};

type Events = {
  "campaign.created": CampaignCreatedEvent;
  "test/hello.world": { data: Record<string, unknown> };
  // Video pipeline events (Phase 06)
  "video.requested": VideoJobPayload;
  "video.script.ready": VideoJobPayload;
  "video.tts.ready": VideoJobPayload;
  "video.visual.ready": VideoJobPayload;
  "video.composed": VideoJobPayload;
  "video.uploaded": VideoJobPayload;
  "video.published": VideoJobPayload;
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "sophia-ai-factory",
  schemas: new EventSchemas().fromRecord<Events>(),
});
