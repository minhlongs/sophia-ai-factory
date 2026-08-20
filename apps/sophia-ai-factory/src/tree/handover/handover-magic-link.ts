/**
 * Magic link token generation and validation for customer handover.
 * Uses crypto.randomUUID stored in D1 with 24h expiry.
 * @module lib/handover/handover-magic-link
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CustomerHandoverRow } from '@/tree/handover/handover-types';

const DEFAULT_TOKEN_TTL_HOURS = 24;
const AUTO_SIGNUP_TOKEN_TTL_HOURS = 72;

/** Generate a new random token (no JWT needed — stored in DB) */
export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Attach a new magic link token to an existing handover row.
 * Auto-signup handovers (FREE100, payment) get a longer 72h window —
 * VIP partners often miss the email for a day.
 */
export async function createMagicLinkToken(
  handoverId: string,
  opts?: { ttlHours?: number; source?: string },
): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const token = generateToken();
  const ttl = opts?.ttlHours
    ?? (opts?.source === 'auto_signup' || opts?.source === 'auto_payment'
      ? AUTO_SIGNUP_TOKEN_TTL_HOURS
      : DEFAULT_TOKEN_TTL_HOURS);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl * 3600;

  await db
    .prepare(
      `UPDATE customer_handovers
       SET magic_link_token = ?1, magic_link_expires_at = ?2
       WHERE id = ?3`,
    )
    .bind(token, expiresAt, handoverId)
    .run();

  return token;
}

/** Validate magic link token — returns handover row or null if invalid/expired */
export async function validateMagicLinkToken(
  token: string,
): Promise<CustomerHandoverRow | null> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const row = await db
      .prepare(
        `SELECT * FROM customer_handovers
         WHERE magic_link_token = ?1
         AND magic_link_expires_at > ?2
         LIMIT 1`,
      )
      .bind(token, Math.floor(Date.now() / 1000))
      .first<CustomerHandoverRow>();

    return row ?? null;
  } catch (err) {
    logger.error('[MagicLink] Validate error', err instanceof Error ? err : undefined);
    return null;
  }
}

/**
 * Consume magic link — mark first login AND invalidate the token to enforce
 * single-use semantics. Without clearing the token, an attacker who captures
 * the link still has 24-72h to mint additional sessions.
 *
 * Returns true when this caller WON the consume race (was the actual single
 * use). Two concurrent consumes for the same handoverId would otherwise both
 * pass validate-then-update; gating on the magic_link_token = ?2 condition
 * means only the first writer's UPDATE has changes>0 — the loser must abort.
 */
export async function consumeMagicLink(handoverId: string, token: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `UPDATE customer_handovers
       SET customer_first_login_at = COALESCE(customer_first_login_at, ?1),
           magic_link_token = NULL,
           magic_link_expires_at = NULL
       WHERE id = ?2 AND magic_link_token = ?3`,
    )
    .bind(now, handoverId, token)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Stamp customer_first_run_at exactly once. Idempotent — subsequent calls
 * are no-ops thanks to COALESCE. Call from anywhere a customer runs a SOP.
 */
export async function markFirstRun(customerUserId: string): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE customer_handovers
         SET customer_first_run_at = COALESCE(customer_first_run_at, ?1)
         WHERE customer_user_id = ?2`,
      )
      .bind(now, customerUserId)
      .run();
  } catch (err) {
    // Non-fatal — should never block a SOP run
    logger.warn('[MagicLink] markFirstRun failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Stamp customer_first_sop_install_at exactly once for a customer.
 */
export async function markFirstSopInstall(customerUserId: string): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE customer_handovers
         SET customer_first_sop_install_at = COALESCE(customer_first_sop_install_at, ?1)
         WHERE customer_user_id = ?2`,
      )
      .bind(now, customerUserId)
      .run();
  } catch (err) {
    logger.warn('[MagicLink] markFirstSopInstall failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
