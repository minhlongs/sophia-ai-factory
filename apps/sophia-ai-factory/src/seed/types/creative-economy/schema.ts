/**
 * Zod schemas for the Creative Economy OS.
 *
 * Validation source for later phases (repo standard: Zod on all API inputs).
 * Entity schemas live in `entities-schema.ts`; this module owns the event
 * envelope schema and the boundary parse helpers, and re-exports the entity
 * schemas so consumers import from a single path.
 *
 * @module seed/types/creative-economy/schema
 */

import { z } from 'zod'
import type { CreativeEconomyEvent } from './events'
import { CreativeEconomyEventKind } from './events'
import { MissionSchema, UnixMs } from './entities-schema'

// Re-export entity schemas + primitives so consumers import from `schema`.
// `CreativeGoal` / `GoalType` are types — re-exported with `export type` so
// `isolatedModules` does not require a runtime re-export of a type-only binding.
export type { CreativeGoal, GoalType } from './entities-schema'
export {
  Cents,
  Channel,
  CreativeMissionStatusSchema,
  MissionSchema,
  NonEmptyString,
  PerformanceSnapshotSchema,
  ProvenanceActionSchema,
  ProvenanceRecordSchema,
  RevenueEventSchema,
  UnixMs,
} from './entities-schema'

// ─── Event schema ────────────────────────────────────────────────────────────

/**
 * Event envelope schema. `kind` is a discriminated literal, so only the 13
 * canonical event kinds parse; the payload is a free-form record at this
 * boundary — concrete payload validation happens in the handlers that
 * consume each kind. Cast to the canonical union so the schema is usable as
 * a `z.ZodType<CreativeEconomyEvent>` for API inputs.
 */
export const CreativeEconomyEventSchema = z.union([
  z.object({
    kind: z.literal(CreativeEconomyEventKind.MISSION_CREATED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.STRATEGY_GENERATED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.IP_REGISTERED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.ASSET_PRODUCED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.ASSET_APPROVED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.ASSET_REJECTED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.DISTRIBUTION_PLANNED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.PUBLICATION_PUBLISHED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.PERFORMANCE_MEASURED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.REVENUE_ATTRIBUTED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.INSIGHT_GENERATED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.MEMORY_UPDATED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
  z.object({
    kind: z.literal(CreativeEconomyEventKind.PLAYBOOK_COMPOUNDED),
    payload: z.record(z.string(), z.unknown()),
    timestamp: UnixMs,
  }),
]) as unknown as z.ZodType<CreativeEconomyEvent>

// ─── Boundary helpers ────────────────────────────────────────────────────────

/** Parse an unknown input as a canonical mission, returning a Result. */
export function parseMission(input: unknown) {
  return MissionSchema.safeParse(input)
}

/** Parse an unknown input as a canonical event, returning a Result. */
export function parseEvent(input: unknown) {
  return CreativeEconomyEventSchema.safeParse(input)
}