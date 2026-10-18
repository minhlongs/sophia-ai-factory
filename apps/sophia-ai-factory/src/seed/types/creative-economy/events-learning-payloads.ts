/**
 * Performance, revenue, learning, memory, and playbook payload types
 * for the Creative Economy event stream.
 *
 * Layer: seed/types/creative-economy
 *
 * @module seed/types/creative-economy/events-learning-payloads
 */

import type {
  CreativeMemory,
  PerformanceSnapshot,
  RevenueEvent,
} from '@/seed/types/creative-domain'
import type { PlaybookPattern } from '@/seed/types/playbook-pattern'
import type {
  AgentRunId,
  AgentTaskId,
  AssetId,
  CreativeMemoryEntryId,
  CreativeStrategyId,
  LearningInsightId,
  PerformanceSnapshotId,
  RevenueEventId,
} from './ids'

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
