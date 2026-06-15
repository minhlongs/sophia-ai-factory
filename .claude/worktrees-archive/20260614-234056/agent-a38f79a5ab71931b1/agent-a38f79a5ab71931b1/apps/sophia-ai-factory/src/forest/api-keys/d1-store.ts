/**
 * D1 adapter for API key CRUD operations.
 * Keys are sha256-hashed at rest — full key never stored.
 * @module lib/api-keys/d1-store
 */

import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const KEY_PREFIX = 'sk_live_';
const KEY_ID_BYTES = 8; // 16 hex chars

// Tier → rate limit (calls/min)
const TIER_RATE_LIMITS: Record<Tier, number> = {
  BASIC: 100,
  PREMIUM: 500,
  ENTERPRISE: 2000,
  MASTER: 2000,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface D1ApiKeyRow {
  id: string;
  key_id: string;
  key_hash: string;
  owner_id: string;
  name: string;
  permissions: string;
  rate_limit_per_min: number;
  created_at: number;
  expires_at: number | null;
  revoked_at: number | null;
  last_used_at: number | null;
}

export interface ApiKeyInfo {
  id: string;
  keyId: string;
  prefix: string;
  name: string;
  permissions: string[];
  rateLimitPerMin: number;
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
  lastUsedAt: number | null;
}

export interface CreateKeyResult {
  fullKey: string;
  keyId: string;
  prefix: string;
  id: string;
  createdAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate 16-hex-char key_id */
function generateKeyId(): string {
  const bytes = new Uint8Array(KEY_ID_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Generate 32-byte random signature (64 hex chars) */
function generateSignature(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash a string using WebCrypto */
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function rowToInfo(row: D1ApiKeyRow): ApiKeyInfo {
  const perms: string[] = (() => {
    try { return JSON.parse(row.permissions) as string[]; } catch { return []; }
  })();
  return {
    id: row.id,
    keyId: row.key_id,
    prefix: `${KEY_PREFIX}${row.key_id.slice(0, 8)}...`,
    name: row.name,
    permissions: perms,
    rateLimitPerMin: row.rate_limit_per_min,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export function tierToRateLimit(tier: Tier): number {
  return TIER_RATE_LIMITS[tier] ?? 100;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Create a new API key. Returns full key ONCE — only hash stored in DB. */
export async function createApiKey(
  db: D1Database,
  ownerId: string,
  name: string,
  rateLimitPerMin: number,
  permissions: string[] = [],
): Promise<CreateKeyResult> {
  const id = crypto.randomUUID();
  const keyId = generateKeyId();
  const signature = generateSignature();
  const fullKey = `${KEY_PREFIX}${keyId}_${signature}`;
  const keyHash = await sha256Hex(fullKey);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO raas_user_api_keys (id, key_id, key_hash, owner_id, name, permissions, rate_limit_per_min, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
    )
    .bind(id, keyId, keyHash, ownerId, name, JSON.stringify(permissions), rateLimitPerMin, now)
    .run();

  logger.info('[D1ApiKeys] Created key', { ownerId, keyId, name });
  return { fullKey, keyId, prefix: `${KEY_PREFIX}${keyId.slice(0, 8)}...`, id, createdAt: now };
}

/** List active keys for a user (never returns hashes or full key). */
export async function listApiKeys(db: D1Database, ownerId: string): Promise<ApiKeyInfo[]> {
  const result = await db
    .prepare(
      `SELECT id, key_id, key_hash, owner_id, name, permissions, rate_limit_per_min,
              created_at, expires_at, revoked_at, last_used_at
       FROM raas_user_api_keys WHERE owner_id = ?1 ORDER BY created_at DESC`,
    )
    .bind(ownerId)
    .all<D1ApiKeyRow>();
  return (result.results ?? []).map(rowToInfo);
}

/** Soft-delete a key via revoked_at timestamp. */
export async function revokeApiKey(db: D1Database, id: string, ownerId: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(`UPDATE raas_user_api_keys SET revoked_at = ?1 WHERE id = ?2 AND owner_id = ?3 AND revoked_at IS NULL`)
    .bind(now, id, ownerId)
    .run();
  logger.info('[D1ApiKeys] Revoked key', { id, ownerId });
  return (result.meta?.changes ?? 0) > 0;
}

/** Rotate: revoke old + create new in sequence. */
export async function rotateApiKey(
  db: D1Database,
  id: string,
  ownerId: string,
  name: string,
  rateLimitPerMin: number,
): Promise<CreateKeyResult | null> {
  const revoked = await revokeApiKey(db, id, ownerId);
  if (!revoked) return null;
  return createApiKey(db, ownerId, name, rateLimitPerMin);
}

/** Verify key by hash comparison — constant-time safe via sha256. */
export async function verifyApiKey(db: D1Database, fullKey: string): Promise<ApiKeyInfo | null> {
  const hash = await sha256Hex(fullKey);
  const row = await db
    .prepare(
      `SELECT id, key_id, key_hash, owner_id, name, permissions, rate_limit_per_min,
              created_at, expires_at, revoked_at, last_used_at
       FROM raas_user_api_keys
       WHERE key_hash = ?1 AND revoked_at IS NULL`,
    )
    .bind(hash)
    .first<D1ApiKeyRow>();
  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at && row.expires_at < now) return null;

  // Update last_used_at (non-fatal)
  db.prepare(`UPDATE raas_user_api_keys SET last_used_at = ?1 WHERE id = ?2`)
    .bind(now, row.id).run().catch(() => {});

  return rowToInfo(row);
}
