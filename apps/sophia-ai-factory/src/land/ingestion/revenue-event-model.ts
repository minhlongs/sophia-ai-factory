/**
 * Revenue Event Schemas, Types & Pure Normalization Helpers
 *
 * @module land/ingestion/revenue-event-model
 */
import { z } from 'zod/v4';
import type { Result } from '@/seed/types/result';
import type { PerformanceEvent } from '@/seed/types/creative-domain';

export const REVENUE_SOURCES = ['ad-revenue', 'sponsorship', 'affiliate', 'commerce'] as const;

export type RevenueSource = (typeof REVENUE_SOURCES)[number];

export const RevenueEventPayloadSchema = z.object({
  source: z.enum(REVENUE_SOURCES),
  externalId: z.string().min(1),
  amountCents: z.number().int(),
  currency: z.string().min(1),
  workspaceId: z.string().min(1),
  assetId: z.string().optional(),
  projectId: z.string().optional(),
  recordedAtMs: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RevenueEventPayload = z.infer<typeof RevenueEventPayloadSchema>;

export type RevenueIngestErrorCode =
  | 'INVALID_PAYLOAD'
  | 'NON_POSITIVE_AMOUNT'
  | 'DB_UNAVAILABLE'
  | 'ALREADY_PROCESSING'
  | 'WRITE_FAILED';

export interface RevenueIngestError {
  code: RevenueIngestErrorCode;
  message: string;
}

export interface RevenueIngestOk {
  eventId: string;
  eventType: string;
  amountCents: number;
  /** True when this call wrote the row; false for a deduped duplicate. */
  inserted: boolean;
  /** True when a prior run already fully processed this event id. */
  alreadyProcessed?: boolean;
}

export type RevenueIngestResult = Result<RevenueIngestOk, RevenueIngestError>;

/** Build the idempotent event id: `revenue_{source}_{externalId}`. */
export function buildRevenueEventId(source: RevenueSource, externalId: string): string {
  return `revenue_${source}_${externalId}`;
}

/** Map a revenue source to the performance_events event_type. */
export function eventTypeForSource(source: RevenueSource): 'revenue' | 'sponsorship' {
  return source === 'sponsorship' ? 'sponsorship' : 'revenue';
}

/** Normalize a validated payload into a PerformanceEvent domain object. Pure. */
export function normalizeRevenueEvent(payload: RevenueEventPayload): PerformanceEvent {
  return {
    id: buildRevenueEventId(payload.source, payload.externalId),
    workspaceId: payload.workspaceId,
    assetId: payload.assetId ?? '',
    projectId: payload.projectId ?? '',
    entityType: 'asset',
    entityId: payload.assetId ?? payload.externalId,
    channel: payload.source,
    eventType: eventTypeForSource(payload.source),
    count: 1,
    valueCents: payload.amountCents,
    recordedAt: payload.recordedAtMs,
    rawData: {
      source: payload.source,
      externalId: payload.externalId,
      currency: payload.currency,
      ...(payload.metadata ?? {}),
    },
  };
}
