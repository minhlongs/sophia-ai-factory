/**
 * @file social-engagement-events.ts
 * @description Inngest event contracts for engagement automation, livestream surge, split tests, and fleet publishing.
 * @layer seed
 */

export type NewsjackingFastTrackTriggeredEvent = {
  data: {
    userId: string;
    signalId: string;
    trendTopic: string;
    pairedOfferId?: string | null;
  };
};

export type CommentDmDispatchTriggeredEvent = {
  data: {
    platform: 'tiktok' | 'instagram' | 'youtube' | 'telegram' | 'whatsapp';
    platformUserId: string;
    commentText: string;
    sourceVideoId?: string;
    sourceCommentId?: string;
    targetOfferId?: string;
  };
};

export type LiveStreamStockSurgeDetectedEvent = {
  data: {
    sessionId: string;
    offerId: string;
    currentViewers: number;
    surgePercentage: number;
    remainingStock: number;
  };
};

export type CompetitorLeadDiscoveredEvent = {
  data: {
    competitorChannel: string;
    targetVideoId: string;
    commentAuthorId: string;
    commentText: string;
    intentScore: number;
  };
};

export type VideoSplitTestEvaluationRequestedEvent = {
  data: {
    experimentId: string;
    campaignId: string;
    variantAViews: number;
    variantAConversions: number;
    variantBViews: number;
    variantBConversions: number;
  };
};

export type FleetStaggerPublishRequestedEvent = {
  data: {
    deploymentId: string;
    userId: string;
    skuId: string;
    targetAccountIds: string[];
    videoAssetUrl: string;
    hookAngles: string[];
    staggerMinutes: number;
  };
};
