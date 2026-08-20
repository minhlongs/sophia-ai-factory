/**
 * Agent API authentication and rate limiting.
 * Handles API key generation (Web Crypto SHA-256), validation, revocation,
 * request logging, and 60-second sliding window rate limiting via D1.
 *
 * Security invariant: raw API keys are NEVER stored — only SHA-256 hashes.
 * @module tree/api/agent-api-auth
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  ApiKey,
  ApiKeyCreationResult,
  ApiPermission,
  RateLimitResult,
} from '@/seed/types/agent-api';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** SHA-256 hex digest using Web Crypto (CF Workers + Node 19+). */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Map a DB row (snake_case) to ApiKey (camelCase). */
function rowToApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    keyHash: row.key_hash as string,
    keyPrefix: row.key_prefix as string,
    name: row.name as string,
    permissions: JSON.parse(row.permissions_json as string) as ApiPermission[],
    rateLimitRpm: row.rate_limit_rpm as number,
    isActive: row.is_active === 1,
    lastUsedAt: row.last_used_at as number | undefined,
    expiresAt: row.expires_at as number | undefined,
    createdAt: row.created_at as number,
  };
}

// ── Key generation ────────────────────────────────────────────────────────────

/**
 * Generate a new API key for a user.
 * rawKey is returned ONCE and never stored — caller must save it securely.
 */
export async function generateApiKey(
  userId: string,
  name: string,
  permissions: ApiPermission[] = ['sop:execute', 'sop:read'],
): Promise<ApiKeyCreationResult> {
  const rawKey = `sk_sophia_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = await sha256Hex(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    await db
      .prepare(
        `INSERT INTO api_keys
           (id, user_id, key_hash, key_prefix, name, permissions_json, rate_limit_rpm, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 60, 1, ?)`,
      )
      .bind(id, userId, keyHash, keyPrefix, name, JSON.stringify(permissions), now)
      .run();
    logger.info('API key generated', { keyId: id, userId, keyPrefix });
    return { id, rawKey, keyPrefix };
  } catch (err) {
    logger.error('Failed to generate API key', { userId, error: getErrorMessage(err) });
    throw err;
  }
}

// ── Key validation ────────────────────────────────────────────────────────────

/**
 * Validate a raw API key. Returns ApiKey on success, null on failure/expiry.
 * Updates last_used_at best-effort (non-blocking).
 */
export async function validateApiKey(rawKey: string): Promise<ApiKey | null> {
  try {
    const keyHash = await sha256Hex(rawKey);
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const now = Math.floor(Date.now() / 1000);

    const row = await db
      .prepare(`SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1`)
      .bind(keyHash)
      .first<Record<string, unknown>>();

    if (!row) return null;
    if (row.expires_at && (row.expires_at as number) < now) return null;

    // Best-effort touch — non-blocking
    db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
      .bind(now, row.id)
      .run()
      .catch((err: unknown) =>
        logger.warn('last_used_at update failed', { keyId: row.id, error: getErrorMessage(err) }),
      );

    return rowToApiKey(row);
  } catch (err) {
    logger.error('API key validation error', { error: getErrorMessage(err) });
    return null;
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Check rate limit for the current 60s window using request log counts.
 * Fails closed (returns allowed:false) on DB error.
 */
export async function checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 60;

    const keyRow = await db
      .prepare(`SELECT rate_limit_rpm FROM api_keys WHERE id = ?`)
      .bind(apiKeyId)
      .first<{ rate_limit_rpm: number }>();

    const limitRpm = keyRow?.rate_limit_rpm ?? 60;

    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM api_request_log WHERE api_key_id = ? AND created_at >= ?`,
      )
      .bind(apiKeyId, windowStart)
      .first<{ cnt: number }>();

    const count = countRow?.cnt ?? 0;
    return {
      allowed: count < limitRpm,
      remaining: Math.max(0, limitRpm - count),
      resetAt: windowStart + 60,
    };
  } catch (err) {
    logger.error('Rate limit check error', { apiKeyId, error: getErrorMessage(err) });
    return { allowed: false, remaining: 0, resetAt: Math.floor(Date.now() / 1000) + 60 };
  }
}

// ── Request logging ───────────────────────────────────────────────────────────

/** Log an API request to api_request_log. Fire-and-forget — errors are swallowed. */
export async function logApiRequest(params: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  requestBodySize?: number;
  responseBodySize?: number;
  errorMessage?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    await db
      .prepare(
        `INSERT INTO api_request_log
           (id, api_key_id, endpoint, method, status_code, duration_ms,
            request_body_size, response_body_size, error_message, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        params.apiKeyId,
        params.endpoint,
        params.method,
        params.statusCode,
        params.durationMs,
        params.requestBodySize ?? null,
        params.responseBodySize ?? null,
        params.errorMessage ?? null,
        params.ipAddress ?? null,
        Math.floor(Date.now() / 1000),
      )
      .run();
  } catch (err) {
    logger.warn('Failed to log API request', { apiKeyId: params.apiKeyId, error: getErrorMessage(err) });
  }
}

// ── Revocation ────────────────────────────────────────────────────────────────

/** Revoke an API key (set is_active = 0). */
export async function revokeApiKey(keyId: string): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    await db.prepare(`UPDATE api_keys SET is_active = 0 WHERE id = ?`).bind(keyId).run();
    logger.info('API key revoked', { keyId });
  } catch (err) {
    logger.error('Failed to revoke API key', { keyId, error: getErrorMessage(err) });
    throw err;
  }
}
