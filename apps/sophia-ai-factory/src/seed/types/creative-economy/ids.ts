/**
 * Branded ID types for the Creative Economy OS.
 *
 * Branding prevents accidental string/id confusion at compile time
 * (a MissionId is never a plain string). Factory functions delegate to
 * crypto.randomUUID() so there are no runtime dependencies.
 *
 * @module seed/types/creative-economy/ids
 */

import type {
  MissionId, AssetId, PublicationId, PerformanceSnapshotId, RevenueEventId,
  LearningInsightId, CreativeMemoryEntryId, ApprovalRequestId, ProvenanceRecordId,
  AgentRunId, AgentTaskId, CreativeStrategyId, StoryWorldId, CharacterId,
  ContentVariantId, DistributionChannelId, DistributionPlanId,
  IntellectualPropertyId, MarketSignalId, AudienceSegmentId, BrandVoiceId,
  HumanDecisionId, AgentCapabilityId, CreativeEconomyBrandId,
} from './id-brands'

export type {
  MissionId, AssetId, PublicationId, PerformanceSnapshotId, RevenueEventId,
  LearningInsightId, CreativeMemoryEntryId, ApprovalRequestId, ProvenanceRecordId,
  AgentRunId, AgentTaskId, CreativeStrategyId, StoryWorldId, CharacterId,
  ContentVariantId, DistributionChannelId, DistributionPlanId,
  IntellectualPropertyId, MarketSignalId, AudienceSegmentId, BrandVoiceId,
  HumanDecisionId, AgentCapabilityId,
}

// ─── Factory functions ────────────────────────────────────────────────────────
// All factories are pure: they read crypto.randomUUID() and cast. No I/O, no
// config, no side effects — safe to call from any layer.

function brand<T extends CreativeEconomyBrandId>(raw: string): T {
  return raw as unknown as T
}

export function createMissionId(raw?: string): MissionId {
  return brand<MissionId>(raw ?? crypto.randomUUID())
}

export function createAssetId(raw?: string): AssetId {
  return brand<AssetId>(raw ?? crypto.randomUUID())
}

export function createPublicationId(raw?: string): PublicationId {
  return brand<PublicationId>(raw ?? crypto.randomUUID())
}

export function createPerformanceSnapshotId(raw?: string): PerformanceSnapshotId {
  return brand<PerformanceSnapshotId>(raw ?? crypto.randomUUID())
}

export function createRevenueEventId(raw?: string): RevenueEventId {
  return brand<RevenueEventId>(raw ?? crypto.randomUUID())
}

export function createLearningInsightId(raw?: string): LearningInsightId {
  return brand<LearningInsightId>(raw ?? crypto.randomUUID())
}

export function createCreativeMemoryEntryId(raw?: string): CreativeMemoryEntryId {
  return brand<CreativeMemoryEntryId>(raw ?? crypto.randomUUID())
}

export function createApprovalRequestId(raw?: string): ApprovalRequestId {
  return brand<ApprovalRequestId>(raw ?? crypto.randomUUID())
}

export function createProvenanceRecordId(raw?: string): ProvenanceRecordId {
  return brand<ProvenanceRecordId>(raw ?? crypto.randomUUID())
}

export function createAgentRunId(raw?: string): AgentRunId {
  return brand<AgentRunId>(raw ?? crypto.randomUUID())
}

export function createAgentTaskId(raw?: string): AgentTaskId {
  return brand<AgentTaskId>(raw ?? crypto.randomUUID())
}

export function createCreativeStrategyId(raw?: string): CreativeStrategyId {
  return brand<CreativeStrategyId>(raw ?? crypto.randomUUID())
}

export function createStoryWorldId(raw?: string): StoryWorldId {
  return brand<StoryWorldId>(raw ?? crypto.randomUUID())
}

export function createCharacterId(raw?: string): CharacterId {
  return brand<CharacterId>(raw ?? crypto.randomUUID())
}

export function createContentVariantId(raw?: string): ContentVariantId {
  return brand<ContentVariantId>(raw ?? crypto.randomUUID())
}

export function createDistributionChannelId(raw?: string): DistributionChannelId {
  return brand<DistributionChannelId>(raw ?? crypto.randomUUID())
}

export function createDistributionPlanId(raw?: string): DistributionPlanId {
  return brand<DistributionPlanId>(raw ?? crypto.randomUUID())
}

export function createIntellectualPropertyId(raw?: string): IntellectualPropertyId {
  return brand<IntellectualPropertyId>(raw ?? crypto.randomUUID())
}

export function createMarketSignalId(raw?: string): MarketSignalId {
  return brand<MarketSignalId>(raw ?? crypto.randomUUID())
}

export function createAudienceSegmentId(raw?: string): AudienceSegmentId {
  return brand<AudienceSegmentId>(raw ?? crypto.randomUUID())
}

export function createBrandVoiceId(raw?: string): BrandVoiceId {
  return brand<BrandVoiceId>(raw ?? crypto.randomUUID())
}

export function createHumanDecisionId(raw?: string): HumanDecisionId {
  return brand<HumanDecisionId>(raw ?? crypto.randomUUID())
}

export function createAgentCapabilityId(raw?: string): AgentCapabilityId {
  return brand<AgentCapabilityId>(raw ?? crypto.randomUUID())
}