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
  const db = getD1();
  if (!db) return;

  void db
    .prepare(
      'INSERT INTO signals_events (ts, event_type, actor, org_id, props_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(Date.now(), event, actor, orgId ?? null, JSON.stringify(props))
    .run();
}
