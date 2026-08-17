/**
 * Creative Memory Module
 * Layer: tree (domain-specific reusable)
 *
 * Persistent, versioned, scoped memory for Sophia 2027.
 * Separated into 7 categories: identity, creative, audience, performance,
 * business, operational, provenance.
 *
 * @module tree/creative-memory
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMemory, MemoryCategory, MemoryConfidence } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CreativeMemoryError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CreativeMemoryError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newMemoryId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'mem_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function memoryRowToDomain(row: {
  id: string;
  workspace_id: string;
  category: string;
  key: string;
  value: string;
  confidence: string;
  source: string;
  evidence: string;
  scope: string;
  scope_id: string | null;
  version: number;
  is_deleted: number;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}): CreativeMemory {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    category: row.category as MemoryCategory,
    key: row.key,
    value: JSON.parse(row.value),
    confidence: row.confidence as MemoryConfidence,
    source: row.source,
    evidence: row.evidence,
    scope: row.scope as CreativeMemory['scope'],
    scopeId: row.scope_id ?? undefined,
    version: row.version,
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

/**
 * Store or update a memory entry.
 * Upserts by (workspace_id, category, key, scope, scope_id).
 * Increments version on update.
 */
export async function upsertMemory(entry: CreativeMemory): Promise<CreativeMemory> {
  const db = getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);

  // Try update first (existing version + 1)
  const existing = await db
    .prepare(
      `SELECT id, version FROM creative_memory
       WHERE workspace_id = ?1 AND category = ?2 AND key = ?3 AND scope = ?4
         AND (scope_id = ?5 OR (scope_id IS NULL AND ?5 IS NULL))
       LIMIT 1`,
    )
    .bind(entry.workspaceId, entry.category, entry.key, entry.scope, entry.scopeId ?? null)
    .first<{ id: string; version: number }>();

  if (existing) {
    const newVersion = existing.version + 1;
    await db
      .prepare(
        `UPDATE creative_memory SET
           value = ?, confidence = ?, source = ?, evidence = ?,
           version = ?, updated_at = ?, expires_at = ?, is_deleted = ?
         WHERE id = ?1`,
      )
      .bind(
        JSON.stringify(entry.value),
        entry.confidence,
        entry.source,
        entry.evidence,
        newVersion,
        now,
        entry.expiresAt ?? null,
        entry.isDeleted ? 1 : 0,
        existing.id,
      )
      .run();
    return { ...entry, version: newVersion, updatedAt: now };
  }

  // Insert new
  entry.id = entry.id || newMemoryId();
  entry.createdAt = now;
  entry.updatedAt = now;
  entry.version = 1;

  await db
    .prepare(
      `INSERT INTO creative_memory
         (id, workspace_id, category, key, value, confidence, source, evidence,
          scope, scope_id, version, is_deleted, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.id,
      entry.workspaceId,
      entry.category,
      entry.key,
      JSON.stringify(entry.value),
      entry.confidence,
      entry.source,
      entry.evidence,
      entry.scope,
      entry.scopeId ?? null,
      1,
      entry.isDeleted ? 1 : 0,
      now,
      now,
      entry.expiresAt ?? null,
    )
    .run();

  return entry;
}

/**
 * Query memory by category + key, optionally scoped.
 */
export async function getMemory(workspaceId: string, category: MemoryCategory, key: string, scope?: CreativeMemory['scope'], scopeId?: string): Promise<CreativeMemory | null> {
  const db = getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(
      `SELECT * FROM creative_memory
       WHERE workspace_id = ?1 AND category = ?2 AND key = ?3 AND is_deleted = 0
         AND (expires_at IS NULL OR expires_at > ?4)
         AND (scope = ?5 OR (?5 IS NULL))
         AND (scope_id = ?6 OR (scope_id IS NULL AND ?6 IS NULL))
       ORDER BY version DESC LIMIT 1`,
    )
    .bind(workspaceId, category, key, Math.floor(Date.now() / 1000), scope ?? null, scopeId ?? null)
    .first<Parameters<typeof memoryRowToDomain>[0]>();

  if (!row) return null;
  return memoryRowToDomain(row as Parameters<typeof memoryRowToDomain>[0]);
}

/**
 * Query memory by category only, optionally filtered by scope.
 */
export async function getMemoryByCategory(workspaceId: string, category: MemoryCategory, scope?: string, scopeId?: string): Promise<CreativeMemory[]> {
  const db = getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `SELECT * FROM creative_memory
       WHERE workspace_id = ?1 AND category = ?2 AND is_deleted = 0
         AND (expires_at IS NULL OR expires_at > ?3)
         AND (scope = ?4 OR (?4 IS NULL))
         AND (scope_id = ?5 OR (scope_id IS NULL AND ?5 IS NULL))
       ORDER BY version DESC`,
    )
    .bind(workspaceId, category, now, scope ?? null, scopeId ?? null)
    .all<Parameters<typeof memoryRowToDomain>[0]>();

  return (result.results ?? []).map(memoryRowToDomain);
}

/**
 * List all memory keys for a workspace.
 */
export async function listMemoryKeys(workspaceId: string): Promise<Array<{ category: string; key: string; scope: string; updatedAt: number }>> {
  const db = getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(
      `SELECT category, key, scope, updated_at as updatedAt FROM creative_memory
       WHERE workspace_id = ?1 AND is_deleted = 0
       ORDER BY updated_at DESC`,
    )
    .bind(workspaceId)
    .all<{ category: string; key: string; scope: string; updatedAt: number }>();

  return result.results ?? [];
}

/**
 * Soft-delete memory by id.
 */
export async function deleteMemory(id: string): Promise<void> {
  const db = getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`UPDATE creative_memory SET is_deleted = 1 WHERE id = ?1`).bind(id).run();
}

/**
 * Hard-delete memory by id (use with caution — breaks provenance).
 */
export async function purgeMemory(id: string): Promise<void> {
  const db = getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`DELETE FROM creative_memory WHERE id = ?1`).bind(id).run();
}

/**
 * Record a learning event with evidence.
 * Convenience: stores as memory with source='agent_inference' and evidence trail.
 */
export async function recordLearning(
  workspaceId: string,
  category: MemoryCategory,
  key: string,
  value: unknown,
  evidence: string,
  scope?: string,
  scopeId?: string,
): Promise<CreativeMemory> {
  return upsertMemory({
    id: newMemoryId(),
    workspaceId,
    category,
    key,
    value,
    confidence: 'medium',
    source: 'performance',
    evidence,
    scope: (scope ?? 'global') as CreativeMemory['scope'],
    scopeId,
    version: 0,
    isDeleted: false,
    createdAt: 0,
    updatedAt: 0,
  });
}