/**
 * Canonical Creative Economy event kind vocabulary, runtime guard, and compounding events.
 *
 * @module seed/types/creative-economy/events-kinds
 */

import type {
  InsightGeneratedPayload,
  MemoryUpdatedPayload,
  PerformanceMeasuredPayload,
  PlaybookCompoundedPayload,
  RevenueAttributedPayload,
} from './events-payloads'

export const CreativeEconomyEventKind = {
  MISSION_CREATED: 'mission.created',
  STRATEGY_GENERATED: 'strategy.generated',
  IP_REGISTERED: 'ip.registered',
  ASSET_PRODUCED: 'asset.produced',
  ASSET_APPROVED: 'asset.approved',
  ASSET_REJECTED: 'asset.rejected',
  DISTRIBUTION_PLANNED: 'distribution.planned',
  PUBLICATION_PUBLISHED: 'publication.published',
  PERFORMANCE_MEASURED: 'performance.measured',
  REVENUE_ATTRIBUTED: 'revenue.attributed',
  INSIGHT_GENERATED: 'insight.generated',
  MEMORY_UPDATED: 'memory.updated',
  PLAYBOOK_COMPOUNDED: 'playbook.compounded',
} as const

export type CreativeEconomyEventKind =
  (typeof CreativeEconomyEventKind)[keyof typeof CreativeEconomyEventKind]

/** All canonical event kinds, in declaration order. */
export const ALL_CREATIVE_ECONOMY_EVENT_KINDS: readonly CreativeEconomyEventKind[] =
  Object.values(CreativeEconomyEventKind)

export type PerformanceMeasuredEvent = {
  kind: typeof CreativeEconomyEventKind.PERFORMANCE_MEASURED
  payload: PerformanceMeasuredPayload
  timestamp: number
}

export type RevenueAttributedEvent = {
  kind: typeof CreativeEconomyEventKind.REVENUE_ATTRIBUTED
  payload: RevenueAttributedPayload
  timestamp: number
}

export type InsightGeneratedEvent = {
  kind: typeof CreativeEconomyEventKind.INSIGHT_GENERATED
  payload: InsightGeneratedPayload
  timestamp: number
}

export type MemoryUpdatedEvent = {
  kind: typeof CreativeEconomyEventKind.MEMORY_UPDATED
  payload: MemoryUpdatedPayload
  timestamp: number
}

export type PlaybookCompoundedEvent = {
  kind: typeof CreativeEconomyEventKind.PLAYBOOK_COMPOUNDED
  payload: PlaybookCompoundedPayload
  timestamp: number
}
