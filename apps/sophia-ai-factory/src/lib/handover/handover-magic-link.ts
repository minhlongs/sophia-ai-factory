/**
 * Magic link token generation and validation for customer handover.
 * Uses crypto.randomUUID stored in D1 with 24h expiry.
 * @module lib/handover/handover-magic-link
 */

import { getD1Raw } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { CustomerHandoverRow } from './handover-types';

const TOKEN_TTL_HOURS = 24;

/** Generate a new random token (no JWT needed — stored in DB) */
export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/** Attach a new magic link token to an existing handover row */
export async function createMagicLinkToken(handoverId: string): Promise<string> {
  const db = await getD1Raw();
  const token = generateToken();
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_HOURS * 3600;

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
    const db = await getD1Raw();
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

/** Consume magic link — mark first login if not already set */
export async function consumeMagicLink(handoverId: string): Promise<void> {
  const db = await getD1Raw();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE customer_handovers
       SET customer_first_login_at = COALESCE(customer_first_login_at, ?1)
       WHERE id = ?2`,
    )
    .bind(now, handoverId)
    .run();
}
