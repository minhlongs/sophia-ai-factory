/**
 * Canonical distribution/revenue/learning contracts — 4 interfaces.
 *
 * CONTRACTS ONLY: method signatures + return types, no implementation.
 * Entities are referenced from `@/seed/types/creative-domain` — never redefined.
 *
 * @module seed/types/creative-economy/interfaces-distribution
 */

import type {
  DistributionPlan,
  ChannelConfig,
  RevenueEvent,
  PerformanceSnapshot,
  PerformanceEvent,
} from '@/seed/types/creative-domain'
import type { Result } from '@/seed/types/result'
import type {
  DistributionPlanId,
  PublicationId,
  RevenueEventId,
  LearningInsightId,
  CreativeMemoryEntryId,
} from './ids'

// ─── IDistributionPlanner ────────────────────────────────────────────────────

export interface IDistributionPlanner {
  /** Build a distribution plan for a set of assets across channels. */
  plan(
    workspaceId: string,
    projectId: string,
    assets: string[],
    channels: ChannelConfig[],
  ): Promise<Result<DistributionPlanId, Error>>
  /** Fetch a plan by id. */
  get(id: DistributionPlanId): Promise<Result<DistributionPlan, Error>>
  /** List plans for a workspace, optionally filtered by status. */
  list(
    workspaceId: string,
    status?: DistributionPlan['status'],
  ): Promise<Result<DistributionPlan[], Error>>
  /** Schedule a plan for publication at a given time. */
  schedule(id: DistributionPlanId, scheduleAt: number): Promise<Result<boolean, Error>>
  /** Cancel a scheduled plan. */
  cancel(id: DistributionPlanId, reason?: string): Promise<Result<boolean, Error>>
}

// ─── IChannelAdapter ─────────────────────────────────────────────────────────

export interface ChannelPublishResult {
  publicationId: PublicationId
  platformPostId?: string
  publishedAt: number
}

export interface IChannelAdapter {
  readonly channel: string
  /** Publish a single asset to this channel. */
  publish(
    workspaceId: string,
    assetId: string,
    config: ChannelConfig,
  ): Promise<Result<ChannelPublishResult, Error>>
  /** Check whether the channel credentials are usable. */
  validate(workspaceId: string): Promise<Result<boolean, Error>>
  /** Fetch the latest analytics for a published asset. */
  fetchAnalytics(
    workspaceId: string,
    publicationId: PublicationId,
  ): Promise<Result<Record<string, unknown>, Error>>
}

// ─── IRevenueAttribution ────────────────────────────────────────────────────

export interface AttributionResult {
  revenueEventId: RevenueEventId
  assetId?: string
  channel: string
  confidence: number
  agentRunId?: string
}

export interface IRevenueAttribution {
  /** Record a raw revenue event. */
  record(event: Omit<RevenueEvent, 'id'>): Promise<Result<RevenueEventId, Error>>
  /** Attribute a revenue event to the asset/agent that produced it. */
  attribute(revenueEventId: RevenueEventId): Promise<Result<AttributionResult, Error>>
  /** Total revenue for a workspace within a window, optionally by channel. */
  total(
    workspaceId: string,
    from: number,
    to: number,
    channel?: string,
  ): Promise<Result<number, Error>>
  /** Revenue events for a given asset. */
  byAsset(assetId: string): Promise<Result<RevenueEvent[], Error>>
}

// ─── ILearningEngine ─────────────────────────────────────────────────────────

export interface LearningInsight {
  id: LearningInsightId
  workspaceId: string
  channel: string
  summary: string
  confidence: number
  basedOn: string[]
}

export interface ILearningEngine {
  /** Analyze performance data and produce insights. */
  analyze(
    workspaceId: string,
    snapshots: PerformanceSnapshot[],
    events: PerformanceEvent[],
  ): Promise<Result<LearningInsight[], Error>>
  /** Persist an insight into creative memory. */
  recordInsight(insight: Omit<LearningInsight, 'id'>): Promise<Result<LearningInsightId, Error>>
  /** Fetch the latest insights for a workspace. */
  latest(workspaceId: string, limit?: number): Promise<Result<LearningInsight[], Error>>
  /** Compound insights into an updated memory entry. */
  compound(
    workspaceId: string,
    insights: LearningInsight[],
  ): Promise<Result<CreativeMemoryEntryId, Error>>
}