/**
 * Algorithm: normalize external revenue payloads into performance_events,
 * guarded by an atomic lock for exactly-once processing.
 *
 * Consumes the `revenue/event.recorded` payload shape and writes one
 * performance_events row per external revenue record. Financial code:
 * Result<T,E> everywhere, zero throw for expected failures.
 *
 * Idempotency is two-layered:
 *   1. Atomic lock on payment_events keyed by `revenue_{source}_{externalId}`
 *      (see ./revenue-event-lock) — dedupes concurrent/duplicate deliveries.
 *   2. performance_events primary key = same event id; the tree-layer writer
 *      uses INSERT OR IGNORE so duplicate rows are no-ops.
 *
 * Event-type mapping: sponsorship source → 'sponsorship'; all other sources
 * → 'revenue' (dashboard-summary sums both). Cost side stays 'mission_completed'
 * — this module never writes cost rows.
 *
 * @module land/ingestion/revenue-events
 */
import { success, failure } from '@/seed/types/result';
import { recordPerformanceEventIdempotent } from '@/tree/performance/events';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { acquireRevenueEventLock, markRevenueLockProcessed } from './revenue-event-lock';
import {
  REVENUE_SOURCES,
  RevenueEventPayloadSchema,
  buildRevenueEventId,
  eventTypeForSource,
  normalizeRevenueEvent,
  type RevenueEventPayload,
  type RevenueIngestError,
  type RevenueIngestErrorCode,
  type RevenueIngestOk,
  type RevenueIngestResult,
  type RevenueSource,
} from './revenue-event-model';

export {
  REVENUE_SOURCES,
  RevenueEventPayloadSchema,
  buildRevenueEventId,
  eventTypeForSource,
  normalizeRevenueEvent,
  type RevenueEventPayload,
  type RevenueIngestError,
  type RevenueIngestErrorCode,
  type RevenueIngestOk,
  type RevenueIngestResult,
  type RevenueSource,
};

/**
 * Validate + lock + normalize + idempotently write one revenue event.
 *
 * Returns:
 * - failure INVALID_PAYLOAD when the raw payload fails zod validation
 * - failure NON_POSITIVE_AMOUNT for zero/negative amounts (skip, no row)
 * - failure DB_UNAVAILABLE when no D1 binding resolves
 * - failure ALREADY_PROCESSING when another run holds a fresh lock
 * - success alreadyProcessed=true when a prior run completed this event id
 * - success inserted=false when the row already exists (deduped)
 * - failure WRITE_FAILED when the D1 write throws unexpectedly
 */
export async function processRevenueEvent(raw: unknown): Promise<RevenueIngestResult> {
  const parsed = RevenueEventPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return failure({ code: 'INVALID_PAYLOAD', message: parsed.error.message });
  }
  const payload = parsed.data;

  if (payload.amountCents <= 0) {
    return failure({
      code: 'NON_POSITIVE_AMOUNT',
      message: `amountCents must be positive, got ${payload.amountCents}`,
    });
  }

  const event = normalizeRevenueEvent(payload);
  const lock = await acquireRevenueEventLock(event.id, JSON.stringify(payload));

  switch (lock.kind) {
    case 'db-unavailable':
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });
    case 'query-failed':
      return failure({ code: 'WRITE_FAILED', message: 'Lock query failed' });
    case 'already-processed':
    case 'stale-recovered':
      logger.info('[revenue-events] Already processed', {
        eventId: event.id,
        stale: lock.kind === 'stale-recovered',
      });
      return success({
        eventId: event.id,
        eventType: event.eventType,
        amountCents: payload.amountCents,
        inserted: false,
        alreadyProcessed: true,
      });
    case 'in-flight':
      return failure({ code: 'ALREADY_PROCESSING', message: 'Another run holds the lock' });
    case 'acquired':
      break;
  }

  try {
    const inserted = await recordPerformanceEventIdempotent(event);
    await markRevenueLockProcessed(event.id);
    logger.info('[revenue-events] Revenue event processed', {
      eventId: event.id,
      eventType: event.eventType,
      amountCents: payload.amountCents,
      inserted,
    });
    return success({
      eventId: event.id,
      eventType: event.eventType,
      amountCents: payload.amountCents,
      inserted,
    });
  } catch (err) {
    logger.error('[revenue-events] Write failed', toError(err), { eventId: event.id });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }
}
