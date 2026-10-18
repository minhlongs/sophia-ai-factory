/**
 * Zod schemas for Creative Economy Telemetry & Revenue entities.
 *
 * Layer: seed/types/creative-economy
 */

import { z } from 'zod'
import type {
  PerformanceSnapshot,
  RevenueEvent,
} from '@/seed/types/creative-domain'

/** Non-empty string with surrounding whitespace trimmed. */
export const NonEmptyString = z.string().trim().min(1)

/** Positive integer cents (currency is stored as integer cents). */
export const Cents = z.number().int().nonnegative()

/** Unix milliseconds. */
export const UnixMs = z.number().int().nonnegative()

/** ISO-8601 or arbitrary tag string; kept loose so legacy payloads validate. */
export const Channel = z.string().trim().min(1).max(64)

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
