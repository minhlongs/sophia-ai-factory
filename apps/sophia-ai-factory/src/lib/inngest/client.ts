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

type Events = {
  "campaign.created": CampaignCreatedEvent;
  "test/hello.world": { data: Record<string, unknown> };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "sophia-ai-factory",
  schemas: new EventSchemas().fromRecord<Events>(),
});
