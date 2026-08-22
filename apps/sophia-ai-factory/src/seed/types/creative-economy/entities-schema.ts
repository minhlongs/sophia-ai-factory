/**
 * Zod schemas for the canonical Creative Economy entities.
 *
 * Split from `schema.ts` to keep that module under the 200-line ceiling.
 * Schemas mirror the canonical entities in `creative-domain.ts` — they do NOT
 * redefine types, they validate shapes. Branded IDs are coerced to plain
 * strings at the boundary; the brand is enforced at compile time by `ids.ts`,
 * not by runtime coercion.
 *
 * @module seed/types/creative-economy/entities-schema
 */

import { z } from 'zod'
import type {
  AutonomyLevel,
  CreativeGoal,
  CreativeMissionStatus,
  GoalType,
  Mission,
  PerformanceSnapshot,
  ProvenanceAction,
  ProvenanceRecord,
  RevenueEvent,
} from '@/seed/types/creative-domain'

// ─── Canonical entity type re-exports ────────────────────────────────────────
// These types live in `creative-domain.ts`; they are re-exported here so the
// mission lifecycle module can import them from the Creative Economy barrel
// (@/seed/types/creative-economy) instead of reaching directly into
// creative-domain.ts. Schemas below mirror these types — they do not redefine
// them.

export type { AutonomyLevel, CreativeGoal, CreativeMissionStatus, GoalType, Mission }

// ─── Primitive re-exports ────────────────────────────────────────────────────

/** Non-empty string with surrounding whitespace trimmed. */
export const NonEmptyString = z.string().trim().min(1)

/** Positive integer cents (currency is stored as integer cents). */
export const Cents = z.number().int().nonnegative()

/** Unix milliseconds. */
export const UnixMs = z.number().int().nonnegative()

/** ISO-8601 or arbitrary tag string; kept loose so legacy payloads validate. */
export const Channel = z.string().trim().min(1).max(64)

// ─── Entity schemas ──────────────────────────────────────────────────────────
// Branded IDs validate as plain non-empty strings here; the brand is a
// compile-time guard in `ids.ts`, not a runtime coercion.

export const CreativeMissionStatusSchema = z.enum([
  'draft',
  'planned',
  'approval_required',
  'running',
  'paused',
  'review',
  'completed',
  'learning',
  'iterating',
] as const satisfies readonly CreativeMissionStatus[])

export const ProvenanceActionSchema = z.enum([
  'created',
  'generated',
  'edited',
  'approved',
  'rejected',
  'published',
  'derived',
  'archived',
] as const satisfies readonly ProvenanceAction[])

export const MissionSchema: z.ZodType<Mission> = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  creatorId: z.string().min(1),
  brandId: z.string().optional(),
  title: NonEmptyString.max(200),
  objective: NonEmptyString.max(2000),
  audience: NonEmptyString.max(200),
  geography: NonEmptyString.max(200),
  timeframeStart: UnixMs,
  timeframeEnd: UnixMs,
  budgetCents: Cents,
  spentCents: Cents,
  autonomyLevel: z.number().int().min(0).max(4).transform((n) => n as AutonomyLevel),
  channels: z.array(Channel).min(1),
  monetizationGoals: z.array(NonEmptyString.max(100)).min(1),
  constraints: z.record(z.string(), z.unknown()),
  successMetrics: z.record(z.string(), z.number()),
  status: CreativeMissionStatusSchema,
  currentPhase: NonEmptyString.max(100),
  createdAt: UnixMs,
  updatedAt: UnixMs,
})

export const ProvenanceRecordSchema: z.ZodType<ProvenanceRecord> = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
  agentRunId: z.string().optional(),
  action: ProvenanceActionSchema,
  actorType: z.enum(['human', 'agent', 'system']),
  actorId: z.string().min(1),
  model: z.string().optional(),
  modelVersion: z.string().optional(),
  prompt: z.string().optional(),
  sourceAssetId: z.string().optional(),
  humanEdits: z.string().optional(),
  approvalId: z.string().optional(),
  derivativeOf: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: UnixMs,
})

export const PerformanceSnapshotSchema: z.ZodType<PerformanceSnapshot> = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
  channel: Channel,
  snapshotDate: UnixMs,
  impressions: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  watchTimeSeconds: z.number().int().nonnegative(),
  retention3s: z.number().min(0).max(1),
  retention30s: z.number().min(0).max(1),
  followerDelta: z.number().int(),
  leadDelta: z.number().int(),
  revenueCents: Cents,
  costCents: Cents,
  creativeRoi: z.number(),
})

export const RevenueEventSchema: z.ZodType<RevenueEvent> = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  assetId: z.string().optional(),
  projectId: z.string().optional(),
  channel: Channel,
  type: z.enum(['sale', 'affiliate', 'ad', 'subscription', 'lead', 'licensing']),
  amountCents: Cents,
  currency: NonEmptyString.max(8),
  metadata: z.record(z.string(), z.unknown()),
  occurredAt: UnixMs,
  recordedAt: UnixMs,
})