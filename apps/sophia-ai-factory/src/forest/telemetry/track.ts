/**
 * D1 Signal Layer — fire-and-forget track() helper
 *
 * Writes a signals_events row to D1 without blocking the request path.
 * Uses globalThis.__env.DB (CF Workers binding) accessed via the same
 * pattern as client.ts getD1Sync(), so test setup mocks work out-of-box.
 *
 * SECURITY: props validated by Zod whitelist before insert — no PII / key material.
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { getD1 } from '@/seed/db/client'
import { type D1EventType, schemaForEvent } from './d1-event-types'

/** Get raw D1Database from CF runtime env (edge-compatible, no Node APIs) */
function getD1Raw(): D1Database {
  const _db = getD1();
  if (!_db) throw new Error('[signals/d1] D1 binding not available');
  return _db;
}

/**
 * Emit a telemetry event to D1 signals_events table.
 *
 * Fire-and-forget — never blocks the caller. Schema validation failure
 * and D1 errors are swallowed with a warn log.
 *
 * @param event   One of D1EventType enum values
 * @param actor   userId | 'system' | 'cron' | 'webhook'
 * @param props   Event-specific payload — validated by per-event Zod schema
 * @param orgId   Optional org context (nullable for pre-signup events)
 */
export function track<T extends D1EventType>(
  event: T,
  actor: string,
  props: unknown,
  orgId?: string | null,
): void {
  // Fire-and-forget: never blocks request
  void (async () => {
    try {
      const safe = schemaForEvent(event).parse(props)
      const db = getD1Raw()
      await db
        .prepare(
          'INSERT INTO signals_events (ts, event_type, actor, org_id, props_json) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(Date.now(), event, actor, orgId ?? null, JSON.stringify(safe))
        .run()
    } catch (err) {
      logger.warn('[signals/d1] track failed', {
        event,
        error: getErrorMessage(err),
      })
    }
  })()
}
