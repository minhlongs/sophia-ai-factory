/**
 * event-bus.ts — In-memory EventEmitter + D1 hooks_registry persistence
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Features:
 *   - Tenant-scoped event handlers (no cross-tenant bleed)
 *   - Persistent registration via D1 hooks_registry
 *   - In-memory dispatch for low-latency same-request events
 */

import { getD1 } from '@/seed/db/client'

export type EventHandler<T = unknown> = (payload: T, tenantId: string) => Promise<void> | void;

interface HandlerEntry<T = unknown> {
  tenantId: string;
  handler: EventHandler<T>;
}

// In-memory registry: event → list of handlers
const _handlers = new Map<string, HandlerEntry[]>();

/**
 * Register an event handler for a specific tenant.
 * Only fires when emit() is called with the same tenantId.
 */
export function onEvent<T = unknown>(
  event: string,
  tenantId: string,
  handler: EventHandler<T>,
): () => void {
  const entry: HandlerEntry<T> = { tenantId, handler };
  const existing = _handlers.get(event) ?? [];
  _handlers.set(event, [...existing, entry as HandlerEntry]);

  // Return unsubscribe function
  return () => {
    const current = _handlers.get(event) ?? [];
    _handlers.set(
      event,
      current.filter((e) => e !== (entry as HandlerEntry)),
    );
  };
}

/**
 * Emit an event for a tenant. Only triggers handlers registered for that tenant.
 */
export async function emit<T = unknown>(
  event: string,
  tenantId: string,
  payload: T,
): Promise<void> {
  const entries = (_handlers.get(event) ?? []).filter(
    (e) => e.tenantId === tenantId,
  );
  await Promise.all(entries.map((e) => e.handler(payload, tenantId)));
}

/**
 * Persist a hook registration to D1 hooks_registry.
 * Does NOT register in-memory — call onEvent() separately for in-process dispatch.
 */
export async function persistHook(
  tenantId: string,
  event: string,
  handlerModule: string,
): Promise<void> {
  const id = `${tenantId}:${event}:${handlerModule}`;
  const now = Date.now();
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  await db
    .prepare(
      `INSERT INTO hooks_registry (id, tenant_id, event, handler_module, enabled, created_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(tenant_id, event, handler_module) DO UPDATE SET enabled = 1`,
    )
    .bind(id, tenantId, event, handlerModule, now)
    .run();
}

/**
 * Load persisted hooks for a tenant+event from D1.
 */
export async function loadHooks(
  tenantId: string,
  event: string,
): Promise<string[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare(
      'SELECT handler_module FROM hooks_registry WHERE tenant_id = ? AND event = ? AND enabled = 1',
    )
    .bind(tenantId, event)
    .all<{ handler_module: string }>();
  return (result.results ?? []).map((r) => r.handler_module);
}

/** Test helper: clear all in-memory handlers */
export function _clearHandlers(): void {
  _handlers.clear();
}
