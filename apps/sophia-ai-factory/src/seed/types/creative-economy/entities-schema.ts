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
  ProvenanceAction,
  ProvenanceRecord,
} from '@/seed/types/creative-domain'
import {
  NonEmptyString,
  Cents,
  UnixMs,
  Channel,
  PerformanceSnapshotSchema,
  RevenueEventSchema,
} from './telemetry-entities-schema'

// ─── Canonical entity type re-exports ────────────────────────────────────────

export type { AutonomyLevel, CreativeGoal, CreativeMissionStatus, GoalType, Mission }

// ─── Primitive & telemetry schema re-exports ─────────────────────────────────

export {
  NonEmptyString,
  Cents,
  UnixMs,
  Channel,
  PerformanceSnapshotSchema,
  RevenueEventSchema,
}

// ─── Entity schemas ──────────────────────────────────────────────────────────

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
