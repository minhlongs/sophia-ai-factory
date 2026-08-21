/**
 * memory-adapter.ts — Memory storage primitive
 * Phase 12: OpenClaw Orchestrator
 *
 * Wraps claude-mem MCP if available; falls back to D1 memory_kv table.
 * All keys are tenant-scoped.
 *
 * @deprecated 2026-08-16 — superseded by `@/tree/creative-memory`. This adapter
 * writes memory without CreativeMemory typing, versioning, scoping, or
 * provenance. Memory must flow through the typed creative-memory repo.
 * Removal permitted after 2026-10-16 (longer buffer for OpenClaw migration).
 * Tracked in `@/seed/types/deprecation-markers` (DEPRECATION_REGISTRY).
 */

import { getD1 } from '@/seed/db/client';

export type MemoryType = 'session' | 'long-term' | 'agent' | 'skill';

export interface MemoryAdapter {
  store(type: MemoryType, key: string, value: unknown, tenantId: string): Promise<void>;
  query(type: MemoryType, key: string, tenantId: string): Promise<unknown | null>;
}

// ── D1 fallback implementation ───────────────────────────────────────────────

async function d1Store(
  tenantId: string,
  type: MemoryType,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = `${tenantId}:${type}:${key}`;
  const now = Date.now();
  const json = JSON.stringify(value);
  await db
    .prepare(
      `INSERT INTO memory_kv (id, tenant_id, type, key_name, value_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, type, key_name) DO UPDATE SET value_json = ?, updated_at = ?`,
    )
    .bind(id, tenantId, type, key, json, now, now, json, now)
    .run();
}

async function d1Query(
  tenantId: string,
  type: MemoryType,
  key: string,
): Promise<unknown | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(
      'SELECT value_json FROM memory_kv WHERE tenant_id = ? AND type = ? AND key_name = ?',
    )
    .bind(tenantId, type, key)
    .first<{ value_json: string }>();
  if (!row) return null;
  return JSON.parse(row.value_json);
}

// ── Public API ───────────────────────────────────────────────────────────────

const d1Memory: MemoryAdapter = {
  async store(type, key, value, tenantId) {
    await d1Store(tenantId, type, key, value);
  },
  async query(type, key, tenantId) {
    return d1Query(tenantId, type, key);
  },
};

/**
 * memory — tenant-scoped memory adapter.
 *
 * Usage:
 *   await memory.store('session', 'last-run', { ts: Date.now() }, tenantId)
 *   const val = await memory.query('session', 'last-run', tenantId)
 */
export const memory: MemoryAdapter = d1Memory;
