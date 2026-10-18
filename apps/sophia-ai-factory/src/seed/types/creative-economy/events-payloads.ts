/**
 * Payload types for the 13 canonical Creative Economy events.
 *
 * Split from `events.ts` to keep that module under the 200-line ceiling.
 * Payloads are plain data contracts; narrowing happens in `events.ts`.
 *
 * @module seed/types/creative-economy/events-payloads
 */

import type {
  CreativeMissionStatus,
  Mission,
} from '@/seed/types/creative-domain'
import type {
  AgentRunId,
  AssetId,
  ApprovalRequestId,
  CreativeStrategyId,
  DistributionChannelId,
  DistributionPlanId,
  IntellectualPropertyId,
  MissionId,
  PublicationId,
} from './ids'

export type {
  PerformanceMeasuredPayload,
  RevenueAttributedPayload,
  InsightGeneratedPayload,
  MemoryUpdatedPayload,
  PlaybookCompoundedPayload,
} from './events-learning-payloads'

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface MissionCreatedPayload {
  missionId: MissionId
  mission: Mission
  previousStatus: CreativeMissionStatus | null
}

export interface StrategyGeneratedPayload {
  strategyId: CreativeStrategyId
  workspaceId: string
  conceptIds: string[]
  audience: string
  channels: string[]
}

export interface IpRegisteredPayload {
  ipId: IntellectualPropertyId
  workspaceId: string
  type: 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand'
  name: string
  parentId?: string
}

export interface AssetProducedPayload {
  assetId: AssetId
  projectId: string
  type: 'script' | 'storyboard' | 'audio' | 'video' | 'image' | 'subtitle' | 'thumbnail'
  agentRunId?: AgentRunId
  storageKey?: string
}

export interface AssetApprovedPayload {
  assetId: AssetId
  approvedBy: string
  approvedAt: number
  approvalRequestId?: ApprovalRequestId
}

export interface AssetRejectedPayload {
  assetId: AssetId
  rejectedBy: string
  rejectedAt: number
  reason: string
  approvalRequestId?: ApprovalRequestId
}

export interface DistributionPlannedPayload {
  planId: DistributionPlanId
  projectId: string
  channels: DistributionChannelId[]
  scheduleAt?: number
}

export interface PublicationPublishedPayload {
  publicationId: PublicationId
  planId: DistributionPlanId
  channel: string
  platformPostId?: string
  publishedAt: number
}