/**
 * Canonical Creative Economy event vocabulary.
 *
 * 13 discriminated-union events, each with a typed payload. `CreativeEconomyEvent`
 * is the single union consumed by every layer; consumers narrow on `kind`.
 *
 * Mission events deliberately use the canonical 9-state vocabulary from
 * `seed/types/creative-domain.ts` (CreativeMissionStatus) rather than the
 * spec's 8-state vocabulary — that divergence is a tracked decision point
 * (plan.md Step D), not an alignment assertion. The DB column
 * `migrations/0233_missions.sql:24` is bound to canonical names.
 *
 * Payload types live in `events-payloads.ts`; this module owns the kind table,
 * the discriminated-union envelope, and the runtime guard.
 *
 * @module seed/types/creative-economy/events
 */

import {
  CreativeEconomyEventKind,
  ALL_CREATIVE_ECONOMY_EVENT_KINDS,
  type PerformanceMeasuredEvent,
  type RevenueAttributedEvent,
  type InsightGeneratedEvent,
  type MemoryUpdatedEvent,
  type PlaybookCompoundedEvent,
} from './events-kinds'
import type {
  AssetApprovedPayload,
  AssetProducedPayload,
  AssetRejectedPayload,
  DistributionPlannedPayload,
  IpRegisteredPayload,
  MissionCreatedPayload,
  PublicationPublishedPayload,
  StrategyGeneratedPayload,
} from './events-payloads'

export {
  CreativeEconomyEventKind,
  ALL_CREATIVE_ECONOMY_EVENT_KINDS,
  type PerformanceMeasuredEvent,
  type RevenueAttributedEvent,
  type InsightGeneratedEvent,
  type MemoryUpdatedEvent,
  type PlaybookCompoundedEvent,
}

// ─── Discriminated union ─────────────────────────────────────────────────────

export type MissionCreatedEvent = {
  kind: typeof CreativeEconomyEventKind.MISSION_CREATED
  payload: MissionCreatedPayload
  timestamp: number
}

export type StrategyGeneratedEvent = {
  kind: typeof CreativeEconomyEventKind.STRATEGY_GENERATED
  payload: StrategyGeneratedPayload
  timestamp: number
}

export type IpRegisteredEvent = {
  kind: typeof CreativeEconomyEventKind.IP_REGISTERED
  payload: IpRegisteredPayload
  timestamp: number
}

export type AssetProducedEvent = {
  kind: typeof CreativeEconomyEventKind.ASSET_PRODUCED
  payload: AssetProducedPayload
  timestamp: number
}

export type AssetApprovedEvent = {
  kind: typeof CreativeEconomyEventKind.ASSET_APPROVED
  payload: AssetApprovedPayload
  timestamp: number
}

export type AssetRejectedEvent = {
  kind: typeof CreativeEconomyEventKind.ASSET_REJECTED
  payload: AssetRejectedPayload
  timestamp: number
}

export type DistributionPlannedEvent = {
  kind: typeof CreativeEconomyEventKind.DISTRIBUTION_PLANNED
  payload: DistributionPlannedPayload
  timestamp: number
}

export type PublicationPublishedEvent = {
  kind: typeof CreativeEconomyEventKind.PUBLICATION_PUBLISHED
  payload: PublicationPublishedPayload
  timestamp: number
}

export type CreativeEconomyEvent =
  | MissionCreatedEvent
  | StrategyGeneratedEvent
  | IpRegisteredEvent
  | AssetProducedEvent
  | AssetApprovedEvent
  | AssetRejectedEvent
  | DistributionPlannedEvent
  | PublicationPublishedEvent
  | PerformanceMeasuredEvent
  | RevenueAttributedEvent
  | InsightGeneratedEvent
  | MemoryUpdatedEvent
  | PlaybookCompoundedEvent

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isCreativeEconomyEvent(value: unknown): value is CreativeEconomyEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { kind?: unknown }).kind === 'string' &&
    (Object.values(CreativeEconomyEventKind) as string[]).includes(
      (value as { kind: string }).kind,
    )
  )
}
