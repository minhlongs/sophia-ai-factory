/**
 * @file pipeline-autonomous-events.ts
 * @description Inngest event contracts for autonomous campaigns and multi-track video pipelines.
 * @layer seed
 */

export type CreativeMissionMultiTrackRequestedData = {
  missionId: string;
  userId: string;
  workspaceId: string;
  topic?: string;
  estimatedScenes?: number;
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  estimatedCostCents?: number;
};

export type AutonomousVideoPipelineRequestedEvent = {
  data: {
    campaignId: string;
    niche: "saas_global" | "crypto_global";
    productName: string;
    productUrl: string;
    productDescription: string;
    targetDurationSeconds?: number;
    affiliateBaseUrl: string;
    jurisdiction?: string;
    targetPlatforms?: ("youtube_shorts" | "tiktok" | "instagram_reels")[];
  };
};

export type NicheVideoCampaignRequestedEvent = {
  data: {
    campaignId?: string;
    userId: string;
    /** Server-resolved workspace id. Jobs without it are blocked before spend. */
    tenantId?: string;
    /** Identity of the verified offer; facts/CTA must come from this offer. */
    offerId?: string;
    /** Set by the server only after offer terms + jurisdiction were verified. */
    termsVerified?: boolean;
    approvalId?: string;
    /** SHA-256 of the approved payload as stored in D1 (not self-asserted). */
    approvalHash?: string;
    maxRenderCostCents?: number;
    targetAccount?: string;
    idempotencyKey?: string;
    niche: "saas_global" | "crypto_global";
    blueprintId: string;
    productName: string;
    productUrl: string;
    targetAudience?: string;
    jurisdiction?: string;
    draftMode?: boolean;
    affiliateCode?: string;
    subId?: string | null;
    vanityCoupon?: string | null;
    locale?: "en" | "vi";
  };
};

export type AutonomousCampaignScalingRequestedEvent = {
  data: {
    tenantId: string;
    evaluatedMetrics: {
      campaignId: string;
      hookName: string;
      niche: "saas_global" | "crypto_global" | "ecommerce_tiktok";
      impressions: number;
      clicks: number;
      conversions: number;
      totalEarningsCents: number;
      publishedVideosCount: number;
      totalCostCents?: number;
      observedWindowHours?: number;
      scalingPermissionGranted?: boolean;
    }[];
    /** Verified offer identity per campaign; scaling refuses to spend without it. */
    offersByCampaign?: Record<string, {
      offerId: string;
      operatorUserId: string;
      productName: string;
      productUrl: string;
      niche: "saas_global" | "crypto_global";
      jurisdiction: string;
      locale: "en" | "vi";
      approvalId: string;
      approvalHash: string;
      termsVerified: boolean;
      maxRenderCostCents: number;
    }>;
  };
};

export type VideoMultiTrackPipelineRequestedEvent = {
  data: {
    pipelineId: string;
    userId: string;
    topic: string;
    targetDurationSeconds?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    language?: 'en' | 'vi';
    voiceId?: string;
    platforms?: ('YOUTUBE_SHORTS' | 'TIKTOK' | 'INSTAGRAM_REELS')[];
  };
};
