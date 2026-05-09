/**
 * TOTP Service — RFC 6238 TOTP implementation using Web Crypto API.
 * Compatible with Cloudflare Workers runtime (no Node.js built-ins).
 *
 * Uses `otpauth` package for standards-compliant TOTP + URI generation.
 * Backup codes: 8 codes in XXXX-XXXX format, SHA-256 hashed before storage.
 *
 * Wave 13 G-I3: Added verifyTotpWithLazyEncrypt() for AES-256-GCM backfill.
 * Existing plaintext secrets (is_encrypted=0 in mfa_secrets) are encrypted
 * in-place on the first successful TOTP verification.
 */

import * as OTPAuth from 'otpauth';
import { logger } from '@/seed/utils/logger-utility';

const ISSUER = 'Sophia AI Factory';
const DIGITS = 6;
const PERIOD = 30;
const ALGORITHM = 'SHA1';
const BACKUP_CODE_COUNT = 8;

/** Generate a new TOTP secret (base32-encoded 20 bytes). */
export function generateTotpSecret(): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    digits: DIGITS,
    period: PERIOD,
    algorithm: ALGORITHM,
  });
  return totp.secret.base32;
}

/** Build an otpauth:// URI for QR code encoding. */
export function generateOtpauthUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

/**
 * Verify a 6-digit TOTP code.
 * window=1 allows ±1 period (±30 s) for clock skew.
 */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: code, window });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * Generate backup codes: BACKUP_CODE_COUNT unique codes in XXXX-XXXX format.
 * Returns plaintext codes — caller must hash before persisting.
 */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: Set<string> = new Set();
  while (codes.size < count) {
    const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    codes.add(`${part1}-${part2}`);
  }
  return Array.from(codes);
}

/**
 * Hash a backup code with SHA-256.
 * Used for storage — plaintext codes are never stored.
 */
export async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash all backup codes and return JSON string for storage.
 */
export async function hashBackupCodesToJson(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map(hashBackupCode));
  return JSON.stringify(hashed);
}

/**
 * Verify a backup code against stored hashes.
 * Returns the index of the matched code, or -1 if not found.
 */
export async function verifyBackupCode(
  code: string,
  storedJson: string,
): Promise<number> {
  const hashed = await hashBackupCode(code);
  const stored: string[] = JSON.parse(storedJson);
  return stored.indexOf(hashed);
}

/**
 * Remove a used backup code from the stored JSON by index.
 * Returns updated JSON string.
 */
export function consumeBackupCode(storedJson: string, index: number): string {
  const stored: string[] = JSON.parse(storedJson);
  stored.splice(index, 1);
  return JSON.stringify(stored);
}

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
 *
 * Algorithm:
 *   1. If `is_encrypted=0` → treat secret as plaintext (decryptFn returns as-is).
 *   2. Verify TOTP against the plaintext secret.
 *   3. On success + `is_encrypted=0` → encrypt and UPDATE mfa_secrets in-place.
 *      Failure to encrypt is logged but does NOT break verify (graceful degradation).
 *   4. Returns true on valid TOTP, false otherwise.
 *
 * @param row       Row from mfa_secrets (totp_secret_enc, is_encrypted)
 * @param code      6-digit TOTP code from user
 * @param userId    User ID for the UPDATE on backfill
 * @param db        DB client (D1Client-compatible)
 * @param decryptFn Function to decrypt the secret (encryptToken/decryptToken from token-crypto)
 * @param encryptFn Function to encrypt the plaintext secret
 * @param window    TOTP validation window (default 1 = ±30s)
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
