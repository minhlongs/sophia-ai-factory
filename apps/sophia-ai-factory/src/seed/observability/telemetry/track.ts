/**
 * Seed-layer signal emitter for telemetry events.
 * Used by observability modules that must not import tree-layer signal helpers.
 */

import { getD1 } from '@/seed/db/client';

export function track(
  event: string,
  actor: string,
  props: Record<string, unknown>,
  orgId?: string | null,
): void {
  // Fire-and-forget: never blocks the caller. D1 errors are swallowed with a
  // warn log — track() must not turn a telemetry miss into a request failure.
  void (async () => {
    const db = await getD1();
    if (!db) return;
    void db
      .prepare(
        'INSERT INTO signals_events (ts, event_type, actor, org_id, props_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(Date.now(), event, actor, orgId ?? null, JSON.stringify(props))
      .run();
  })();
}
