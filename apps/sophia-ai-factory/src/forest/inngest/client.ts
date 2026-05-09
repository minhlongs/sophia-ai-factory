import { Inngest, EventSchemas } from "inngest";
import { Tier } from "@/seed/types";

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

type ConversionCreatedEvent = {
  data: {
    conversionEventId: string;
    tenantId: string;
  };
};

type CommissionMaturedEvent = {
  data: {
    updatedCount: number;
    promotedAt: number;
  };
};

type PayoutBatchedEvent = {
  data: {
    batchId: string;
    affiliateId: string;
    /** Payout amount in INTEGER cents (C1: no float drift) */
    totalCents: number;
    externalPaymentId: string;
  };
};

type PayoutConfirmedEvent = {
  data: {
    batchId: string;
    externalPaymentId: string;
    confirmedAt: number;
  };
};

type PayoutReconcileAlertEvent = {
  data: {
    tenantId: string;
    /** All amounts in INTEGER cents (C1) */
    ledgerTotalCents: number;
    batchTotalCents: number;
    diffCents: number;
  };
};

type UrlRevenueVideoRequestedEvent = {
  data: {
    jobId: string;
    tenantId: string;
    prompt: string;
    locale: string;
    channel: string;
    trackingLink?: string;
  };
};

type VideoGenerateRequestedEvent = {
  data: {
    missionId: string;
    userId: string;
    prompt: string;
    voiceoverText?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    durationSec?: number;
    language?: 'en' | 'vi';
  };
};

type Events = {
  "campaign.created": CampaignCreatedEvent;
  "test/hello.world": { data: Record<string, unknown> };
  // URL-to-Revenue pipeline events (Master tier)
  "url_revenue.video.requested": UrlRevenueVideoRequestedEvent;
  // Video pipeline events (Phase 06)
  "video.requested": VideoJobPayload;
  "video.script.ready": VideoJobPayload;
  "video.tts.ready": VideoJobPayload;
  "video.visual.ready": VideoJobPayload;
  "video.composed": VideoJobPayload;
  "video.uploaded": VideoJobPayload;
  "video.published": VideoJobPayload;
  // Publishing pipeline events (Phase 10)
  "publish.scheduled": VideoJobPayload;
  "publish.token.refresh": { data: Record<string, never> };
  // Mission video generation (Wave 13 I2)
  "video/generate.requested": VideoGenerateRequestedEvent;
  // Payout pipeline events (Phase 13)
  "conversion.created": ConversionCreatedEvent;
  "commission.matured": CommissionMaturedEvent;
  "payout.batched": PayoutBatchedEvent;
  "payout.confirmed": PayoutConfirmedEvent;
  "payout.reconcile.alert": PayoutReconcileAlertEvent;
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "sophia-ai-factory",
  schemas: new EventSchemas().fromRecord<Events>(),
});
