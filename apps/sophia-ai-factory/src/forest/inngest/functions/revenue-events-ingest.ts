/**
 * Inngest function: consume `revenue/event.recorded` and persist the revenue
 * into performance_events via the land ingestion module.
 *
 * Orchestration only — validation, atomic lock (payment_events,
 * INSERT ... ON CONFLICT DO NOTHING + meta.changes ownership + 5-min stale
 * recovery), normalization, and the idempotent write all live in
 * land/ingestion/revenue-events (forest→land orchestration exception).
 *
 * Failure semantics: ALREADY_PROCESSING (concurrent run holds a fresh lock)
 * throws so Inngest retries; every other failure code is terminal for this
 * delivery and is returned, not thrown.
 *
 * @module forest/inngest/functions/revenue-events-ingest
 */
import { inngest } from '@/seed/inngest/client';
import { processRevenueEvent } from '@/land/ingestion/revenue-events';
import { logger } from '@/seed/utils/logger-utility';

export const revenueEventsIngest = inngest.createFunction(
  { id: 'revenue-events-ingest', retries: 2 },
  { event: 'revenue/event.recorded' },
  async ({ event, step }) => {
    const result = await step.run('process-revenue-event', () =>
      processRevenueEvent(event.data),
    );

    if (!result.ok) {
      if (result.error.code === 'ALREADY_PROCESSING') {
        // Concurrent run holds a fresh lock — retry later via Inngest.
        throw new Error(`revenue event lock busy: ${result.error.message}`);
      }
      logger.error('[revenue-events-ingest] Terminal failure', {
        code: result.error.code,
        message: result.error.message,
      });
      return { ok: false, code: result.error.code, message: result.error.message };
    }

    return {
      ok: true,
      eventId: result.value.eventId,
      eventType: result.value.eventType,
      inserted: result.value.inserted,
      alreadyProcessed: result.value.alreadyProcessed ?? false,
    };
  },
);
