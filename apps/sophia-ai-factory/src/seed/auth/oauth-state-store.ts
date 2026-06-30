/**
 * Server-side OAuth state nonce store.
 *
 * Keeps sensitive OAuth credentials (clientSecret, etc.) out of URL state params.
 * Nonces are single-use and expire after ttlSec seconds (default 600 = 10 min).
 *
 * Backed by the `oauth_state_store` D1 table (migration 0095).
 * Payload encrypted via AES-256-GCM (encryptToken/decryptToken from token-crypto).
 */

import { encryptToken, decryptToken } from '@/seed/crypto/token-crypto';

/** Minimal D1 binding interface */
interface D1Binding {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
      first<T>(): Promise<T | null>;
    };
  };
}

/**
 * Store an OAuth state payload server-side.
 * Returns an opaque nonce suitable for use as URL state param.
 */
export async function storeOauthState(
  provider: string,
  userId: string,
  payload: Record<string, unknown>,
  db: D1Binding,
  ttlSec = 600,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  const payloadEncrypted = await encryptToken(JSON.stringify(payload));

  await db
    .prepare(
      `INSERT INTO oauth_state_store (state_nonce, user_id, provider, payload_encrypted, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(nonce, userId, provider, payloadEncrypted, expiresAt)
    .run();

  return nonce;
}

/**
 * Consume an OAuth state nonce (single-use).
 * Returns decrypted payload or null if not found, expired, or already used.
 */
export async function consumeOauthState(
  nonce: string,
  db: D1Binding,
): Promise<Record<string, unknown> | null> {
  const row = await db
    .prepare(
      'SELECT payload_encrypted, expires_at FROM oauth_state_store WHERE state_nonce = ?1',
    )
    .bind(nonce)
    .first<{ payload_encrypted: string; expires_at: number }>();

  if (!row) return null;

  // Check expiry
  if (Math.floor(Date.now() / 1000) > row.expires_at) {
    // Clean up expired nonce
    await db
      .prepare('DELETE FROM oauth_state_store WHERE state_nonce = ?1')
      .bind(nonce)
      .run();
    return null;
  }

  // Delete nonce (single-use)
  const del = await db
    .prepare('DELETE FROM oauth_state_store WHERE state_nonce = ?1')
    .bind(nonce)
    .run();

  if ((del.meta?.changes ?? 0) === 0) {
    // Race condition — already consumed
    return null;
  }

  try {
    const decrypted = await decryptToken(row.payload_encrypted);
    return JSON.parse(decrypted) as Record<string, unknown>;
  } catch {
    return null;
  }
}
