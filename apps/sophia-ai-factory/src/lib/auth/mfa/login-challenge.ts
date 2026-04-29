/**
 * MFA Login Challenge helpers.
 *
 * After a successful password login, if the user has TOTP enabled:
 *   1. Call markSessionMfaPending() to record the session as unverified.
 *   2. Middleware checks isSessionMfaPending() on every protected request.
 *   3. On successful TOTP, call clearSessionMfaPending() to lift the gate.
 *
 * TTL: 10 minutes — if user doesn't complete MFA in that window the session
 * row expires and middleware will redirect to /auth/mfa-challenge again.
 */

import { createServerClient } from '@/lib/db/client';

const MFA_PENDING_TTL_SECONDS = 10 * 60; // 10 minutes

/** Shape of a row from mfa_secrets (only columns we care about here). */
interface MfaSecretsRow {
  totp_enabled: number;
}

/** Shape of a row from mfa_pending_sessions. */
interface MfaPendingRow {
  session_id: string;
  expires_at: number;
}

/**
 * Returns whether the authenticated user has TOTP MFA enabled.
 * Used right after Better Auth signs the user in.
 */
export async function requireMfaIfEnabled(
  userId: string,
): Promise<{ required: boolean }> {
  const db = createServerClient();
  const result = await db
    .from('mfa_secrets')
    .select('totp_enabled')
    .eq('user_id', userId)
    .single();

  const row = result.data as MfaSecretsRow | null;
  return { required: row?.totp_enabled === 1 };
}

/**
 * Marks the given session as MFA-pending with a 10-minute TTL.
 * Idempotent — safe to call multiple times (uses INSERT OR REPLACE).
 */
export async function markSessionMfaPending(sessionId: string): Promise<void> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + MFA_PENDING_TTL_SECONDS;

  // D1Client upsert: delete existing then insert
  await db.from('mfa_pending_sessions').delete().eq('session_id', sessionId);
  await db.from('mfa_pending_sessions').insert({
    session_id: sessionId,
    expires_at: expiresAt,
    created_at: now,
  });
}

/**
 * Clears MFA-pending status after successful TOTP verification.
 */
export async function clearSessionMfaPending(sessionId: string): Promise<void> {
  const db = createServerClient();
  await db.from('mfa_pending_sessions').delete().eq('session_id', sessionId);
}

/**
 * Returns true when session has a live (non-expired) MFA-pending record.
 * Middleware calls this on every protected request.
 */
export async function isSessionMfaPending(sessionId: string): Promise<boolean> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .from('mfa_pending_sessions')
    .select('session_id, expires_at')
    .eq('session_id', sessionId)
    .single();

  const row = result.data as MfaPendingRow | null;
  if (!row) return false;

  // Treat expired rows as not-pending (they will be cleaned up lazily)
  return row.expires_at > now;
}
