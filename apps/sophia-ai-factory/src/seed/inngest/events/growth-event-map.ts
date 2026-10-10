/**
 * @file growth-event-map.ts
 * @description Growth, viral, feedback, and social Inngest event mappings.
 * @layer seed
 */

import type {
  SocialSyndicationRequestedEvent,
  SocialPublishDispatchedEvent,
  SocialAnalyticsSyncRequestedEvent,
  SocialAnalyticsFeedbackEvaluatedEvent,
  CreativeMutationRequestedEvent,
  ViralAudioComposeRequestedEvent,
  MultilingualDubbingRequestedEvent,
  LiveStreamLoopRefreshRequestedEvent,
  NewsjackingFastTrackTriggeredEvent,
  CommentDmDispatchTriggeredEvent,
  LiveStreamStockSurgeDetectedEvent,
  CompetitorLeadDiscoveredEvent,
  VideoSplitTestEvaluationRequestedEvent,
  FleetStaggerPublishRequestedEvent,
} from './social-creative-events';

import type {
  TrendingSkuDetectedEvent,
  VoiceCartRecoveryTriggeredEvent,
  AdsArbitrageOptimizedEvent,
  SeoParasiteSyndicatedEvent,
  B2bOutreachDispatchedEvent,
  TiktokSampleEvaluatedEvent,
  OmnichannelAttributionCalculatedEvent,
  RetargetingWinbackEvaluatedEvent,
  AffiliateDealMatchedEvent,
  ViralRepurposeDispatchedEvent,
  PaywallMabRecalibratedEvent,
  KolOutreachEnrolledEvent,
  HookAbWinnerPromotedEvent,
  SeoSurgeDetectedEvent,
} from './growth-viral-events-a';

import type {
  SmartLinkYieldRebalancedEvent,
  RetentionCliffTrimmedEvent,
  SponsorshipRateCardCalculatedEvent,
  ReframeAspectRenderedEvent,
  ThumbnailGazeScoredEvent,
  AudioResonanceSyncedEvent,
  CommunityBaitGeneratedEvent,
  SubscriberCohortEvaluatedEvent,
  AffiliateYieldRoutedEvent,
  ShadowbanAnomalyDetectedEvent,
  SemanticCultureScoredEvent,
  GrowthV12ReseedTriggerEvent,
  GrowthV12WebhookReceivedEvent,
  GrowthV13BanditEvaluateEvent,
  GrowthV13DeliberationRequestEvent,
  GrowthV14RenderScheduleEvent,
  GrowthV14RenderStage1EvaluateEvent,
  GrowthV14RenderHaltEvent,
  GrowthV15FeedbackIngestEvent,
  GrowthV15TelemetryPollEvent,
  GrowthV15PriorRecalibrateEvent,
} from './growth-viral-events-b';

export type GrowthEvents = {
  "growth/v15.telemetry.poll": GrowthV15TelemetryPollEvent;
  "growth/v15.prior.recalibrate": GrowthV15PriorRecalibrateEvent;
  "growth/v15.feedback.ingest": GrowthV15FeedbackIngestEvent;
  "growth/v14.render.schedule": GrowthV14RenderScheduleEvent;
  "growth/v14.render.stage1_evaluate": GrowthV14RenderStage1EvaluateEvent;
  "growth/v14.render.halt": GrowthV14RenderHaltEvent;
  "growth/v13.bandit.evaluate": GrowthV13BanditEvaluateEvent;
  "growth/v13.deliberation.request": GrowthV13DeliberationRequestEvent;
  "growth/v12.reseed.trigger": GrowthV12ReseedTriggerEvent;
  "growth/v12.webhook.received": GrowthV12WebhookReceivedEvent;
  "growth.video.attribution_received": { data: { videoId: string; customerId: string; platform: string; metrics: Record<string, unknown>; }; };
  "growth.v11.arbitrage_requested": {
    data: {
      videoId: string;
      userId: string;
      userTier?: string;
      primaryPlatform: string;
      targetPlatforms: string[];
      metrics: Record<string, number | undefined>;
      originalHookText: string;
      durationSeconds?: number;
      velocityScore?: number;
    };
  };
  "social.syndication.requested": SocialSyndicationRequestedEvent;
  "social.publish.dispatched": SocialPublishDispatchedEvent;
  "social.analytics.sync_requested": SocialAnalyticsSyncRequestedEvent;
  "social.analytics.feedback_evaluated": SocialAnalyticsFeedbackEvaluatedEvent;
  "creative.mutation.requested": CreativeMutationRequestedEvent;
  "viral.audio.compose.requested": ViralAudioComposeRequestedEvent;
  "multilingual.dubbing.requested": MultilingualDubbingRequestedEvent;
  "live.stream.loop.refresh.requested": LiveStreamLoopRefreshRequestedEvent;
  "newsjacking.fasttrack.triggered": NewsjackingFastTrackTriggeredEvent;
  "comment.dm.dispatch.triggered": CommentDmDispatchTriggeredEvent;
  "live.stream.stock.surge.detected": LiveStreamStockSurgeDetectedEvent;
  "competitor.lead.discovered": CompetitorLeadDiscoveredEvent;
  "video.splittest.evaluation.requested": VideoSplitTestEvaluationRequestedEvent;
  "fleet.stagger.publish.requested": FleetStaggerPublishRequestedEvent;
  "trending.sku.detected": TrendingSkuDetectedEvent;
  "voice.cart.recovery.triggered": VoiceCartRecoveryTriggeredEvent;
  "ads.arbitrage.optimized": AdsArbitrageOptimizedEvent;
  "seo.parasite.syndicated": SeoParasiteSyndicatedEvent;
  "b2b.outreach.dispatched": B2bOutreachDispatchedEvent;
  "tiktok.sample.evaluated": TiktokSampleEvaluatedEvent;
  "omnichannel.attribution.calculated": OmnichannelAttributionCalculatedEvent;
  "retargeting.winback.evaluated": RetargetingWinbackEvaluatedEvent;
  "affiliate.deal.matched": AffiliateDealMatchedEvent;
  "viral.repurpose.dispatched": ViralRepurposeDispatchedEvent;
  "paywall.mab.recalibrated": PaywallMabRecalibratedEvent;
  "kol.outreach.enrolled": KolOutreachEnrolledEvent;
  "hook.ab.winner.promoted": HookAbWinnerPromotedEvent;
  "seo.surge.detected": SeoSurgeDetectedEvent;
  "smartlink.yield.rebalanced": SmartLinkYieldRebalancedEvent;
  "retention.cliff.trimmed": RetentionCliffTrimmedEvent;
  "sponsorship.ratecard.calculated": SponsorshipRateCardCalculatedEvent;
  "reframe.aspect.rendered": ReframeAspectRenderedEvent;
  "thumbnail.gaze.scored": ThumbnailGazeScoredEvent;
  "audio.resonance.synced": AudioResonanceSyncedEvent;
  "community.bait.generated": CommunityBaitGeneratedEvent;
  "subscriber.cohort.evaluated": SubscriberCohortEvaluatedEvent;
  "affiliate.yield.routed": AffiliateYieldRoutedEvent;
  "shadowban.anomaly.detected": ShadowbanAnomalyDetectedEvent;
  "semantic.culture.scored": SemanticCultureScoredEvent;
};
