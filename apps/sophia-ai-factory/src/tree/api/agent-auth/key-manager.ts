/**
 * Key generation, validation, and revocation for agent API auth.
 * Raw API keys are NEVER stored — only SHA-256 hashes.
 * @module tree/api/agent-auth/key-manager
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  ApiKey,
  ApiKeyCreationResult,
  ApiPermission,
} from '@/seed/types/agent-api';
import { sha256Hex, rowToApiKey } from './hash';

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
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
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

/**
 * Validate a raw API key. Returns ApiKey on success, null on failure/expiry.
 * Updates last_used_at best-effort (non-blocking).
 */
export async function validateApiKey(rawKey: string): Promise<ApiKey | null> {
  try {
    const keyHash = await sha256Hex(rawKey);
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
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

/** Revoke an API key (set is_active = 0). */
export async function revokeApiKey(keyId: string): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    await db.prepare(`UPDATE api_keys SET is_active = 0 WHERE id = ?`).bind(keyId).run();
    logger.info('API key revoked', { keyId });
  } catch (err) {
    logger.error('Failed to revoke API key', { keyId, error: getErrorMessage(err) });
    throw err;
  }
}
