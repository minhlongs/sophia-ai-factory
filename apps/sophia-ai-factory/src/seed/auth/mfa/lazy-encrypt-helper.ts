/**
 * Lazy encrypt backfill helper for TOTP MFA secrets.
 *
 * @module seed/auth/mfa/lazy-encrypt-helper
 */

import { logger } from '@/seed/utils/logger-utility';
import { verifyTotp } from './totp-core';

/**
 * Row shape for lazy-encrypt backfill — minimal fields needed from mfa_secrets.
 */
export interface MfaSecretsEncRow {
  totp_secret_enc: string;
  is_encrypted: number;
}

/**
 * DB client interface sufficient for the lazy-encrypt path.
 * Accepts any object with a `from()` method compatible with D1Client pattern.
 */
export interface LazyEncryptDb {
  from(table: string): {
    update(values: Record<string, unknown>): { eq(col: string, val: string): Promise<unknown> };
  };
}

/**
 * Verify TOTP code with lazy AES-256-GCM backfill (Wave 13 G-I3).
 */
export async function verifyTotpWithLazyEncrypt(
  row: MfaSecretsEncRow,
  code: string,
  userId: string,
  db: LazyEncryptDb,
  decryptFn: (s: string) => Promise<string>,
  encryptFn: (s: string) => Promise<string>,
  window = 1,
): Promise<boolean> {
  // Decrypt (handles both `aes:` prefix and plaintext pass-through)
  const secretPlain = await decryptFn(row.totp_secret_enc);
  const valid = verifyTotp(secretPlain, code, window);
  if (!valid) return false;

  // Lazy backfill: only if secret is NOT yet encrypted
  if (!row.is_encrypted) {
    try {
      const encryptedSecret = await encryptFn(secretPlain);
      const now = Math.floor(Date.now() / 1000);
      await db
        .from('mfa_secrets')
        .update({ totp_secret_enc: encryptedSecret, is_encrypted: 1, updated_at: now })
        .eq('user_id', userId);
      logger.info('[TOTP] Lazy-encrypted plaintext secret', { userId });
    } catch (err) {
      // Non-fatal: log but do not break verification
      logger.error('[TOTP] Lazy-encrypt failed — secret remains plaintext', err instanceof Error ? err : new Error(String(err)));
    }
  }

  return true;
}
