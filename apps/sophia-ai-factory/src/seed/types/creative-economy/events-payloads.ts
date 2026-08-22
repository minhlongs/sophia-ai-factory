/**
 * Payload types for the 13 canonical Creative Economy events.
 *
 * Split from `events.ts` to keep that module under the 200-line ceiling.
 * Payloads are plain data contracts; narrowing happens in `events.ts`.
 *
 * @module seed/types/creative-economy/events-payloads
 */

import type {
  CreativeMemory,
  CreativeMissionStatus,
  Mission,
  PerformanceSnapshot,
  RevenueEvent,
} from '@/seed/types/creative-domain'
import type { PlaybookPattern } from '@/seed/types/playbook-pattern'
import type {
  AgentRunId,
  AgentTaskId,
  AssetId,
  ApprovalRequestId,
  CreativeMemoryEntryId,
  CreativeStrategyId,
  DistributionChannelId,
  DistributionPlanId,
  IntellectualPropertyId,
  LearningInsightId,
  MissionId,
  PerformanceSnapshotId,
  PublicationId,
  RevenueEventId,
} from './ids'

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

export interface PerformanceMeasuredPayload {
  snapshotId: PerformanceSnapshotId
  assetId: AssetId
  channel: string
  snapshot: PerformanceSnapshot
  revenueEvents: RevenueEvent[]
}

export interface RevenueAttributedPayload {
  revenueEventId: RevenueEventId
  assetId: AssetId
  channel: string
  revenueEvent: RevenueEvent
  attribution: {
    agentRunId?: AgentRunId
    agentTaskId?: AgentTaskId
    strategyId?: CreativeStrategyId
    confidence: number
  }
}

export interface InsightGeneratedPayload {
  insightId: LearningInsightId
  workspaceId: string
  channel: string
  summary: string
  confidence: number
  basedOn: string[]
}

export interface MemoryUpdatedPayload {
  entryId: CreativeMemoryEntryId
  memory: CreativeMemory
  previousVersion: number
  reason: 'performance' | 'human_edit' | 'agent_inference' | 'import'
}

export interface PlaybookCompoundedPayload {
  patternId: string
  playbookRuleId: string
  workspaceId: string
  platform: string
  appliedCount: number
  confidence: number
  basedOn: PlaybookPattern[]
}