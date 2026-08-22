/**
 * Branded ID types for the Creative Economy OS.
 *
 * Branding prevents accidental string/id confusion at compile time
 * (a MissionId is never a plain string). Factory functions delegate to
 * crypto.randomUUID() so there are no runtime dependencies.
 *
 * @module seed/types/creative-economy/ids
 */

// ─── Branded ID types ────────────────────────────────────────────────────────

export type MissionId = string & { readonly __brand: 'MissionId' }
export type AssetId = string & { readonly __brand: 'AssetId' }
export type PublicationId = string & { readonly __brand: 'PublicationId' }
export type PerformanceSnapshotId = string & { readonly __brand: 'PerformanceSnapshotId' }
export type RevenueEventId = string & { readonly __brand: 'RevenueEventId' }
export type LearningInsightId = string & { readonly __brand: 'LearningInsightId' }
export type CreativeMemoryEntryId = string & { readonly __brand: 'CreativeMemoryEntryId' }
export type ApprovalRequestId = string & { readonly __brand: 'ApprovalRequestId' }
export type ProvenanceRecordId = string & { readonly __brand: 'ProvenanceRecordId' }
export type AgentRunId = string & { readonly __brand: 'AgentRunId' }
export type AgentTaskId = string & { readonly __brand: 'AgentTaskId' }
export type CreativeStrategyId = string & { readonly __brand: 'CreativeStrategyId' }
export type StoryWorldId = string & { readonly __brand: 'StoryWorldId' }
export type CharacterId = string & { readonly __brand: 'CharacterId' }
export type ContentVariantId = string & { readonly __brand: 'ContentVariantId' }
export type DistributionChannelId = string & { readonly __brand: 'DistributionChannelId' }
export type DistributionPlanId = string & { readonly __brand: 'DistributionPlanId' }
export type IntellectualPropertyId = string & { readonly __brand: 'IntellectualPropertyId' }
export type MarketSignalId = string & { readonly __brand: 'MarketSignalId' }
export type AudienceSegmentId = string & { readonly __brand: 'AudienceSegmentId' }
export type BrandVoiceId = string & { readonly __brand: 'BrandVoiceId' }
export type HumanDecisionId = string & { readonly __brand: 'HumanDecisionId' }
export type AgentCapabilityId = string & { readonly __brand: 'AgentCapabilityId' }

// ─── Factory functions ────────────────────────────────────────────────────────
// All factories are pure: they read crypto.randomUUID() and cast. No I/O, no
// config, no side effects — safe to call from any layer.

function brand<T extends Brand>(raw: string): T {
  return raw as unknown as T
}

type Brand = MissionId | AssetId | PublicationId | PerformanceSnapshotId | RevenueEventId
  | LearningInsightId | CreativeMemoryEntryId | ApprovalRequestId | ProvenanceRecordId
  | AgentRunId | AgentTaskId | CreativeStrategyId | StoryWorldId | CharacterId
  | ContentVariantId | DistributionChannelId | DistributionPlanId
  | IntellectualPropertyId | MarketSignalId | AudienceSegmentId | BrandVoiceId
  | HumanDecisionId | AgentCapabilityId

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