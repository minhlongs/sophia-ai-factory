/**
 * Branded ID type definitions for the Creative Economy OS.
 *
 * Layer: seed/types/creative-economy
 *
 * @module seed/types/creative-economy/id-brands
 */

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

export type CreativeEconomyBrandId =
  | MissionId
  | AssetId
  | PublicationId
  | PerformanceSnapshotId
  | RevenueEventId
  | LearningInsightId
  | CreativeMemoryEntryId
  | ApprovalRequestId
  | ProvenanceRecordId
  | AgentRunId
  | AgentTaskId
  | CreativeStrategyId
  | StoryWorldId
  | CharacterId
  | ContentVariantId
  | DistributionChannelId
  | DistributionPlanId
  | IntellectualPropertyId
  | MarketSignalId
  | AudienceSegmentId
  | BrandVoiceId
  | HumanDecisionId
  | AgentCapabilityId
