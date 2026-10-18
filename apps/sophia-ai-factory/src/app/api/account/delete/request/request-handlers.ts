import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { sha256Hex } from '@/seed/security/token-hash';
import { buildDeleteConfirmHtml } from './email-template';

export const COOLDOWN_DAYS = 7;
export const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export const bodySchema = z.object({
  action: z.enum(['request', 'cancel']).default('request'),
});

export interface DeletionRow {
  user_id: string;
  confirmed_at: number | null;
  cancelled_at: number | null;
  scheduled_at: number;
}

export async function cancelRequest(db: D1Database, userId: string): Promise<NextResponse> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `UPDATE account_deletion_requests
       SET cancelled_at = ?
       WHERE user_id = ? AND cancelled_at IS NULL`
    )
    .bind(now, userId)
    .run();
  const changes = result.meta?.changes ?? 0;
  if (changes === 0) {
    return NextResponse.json({ error: 'No active deletion request' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, cancelled: true });
}

export async function createRequest(
  db: D1Database,
  userId: string,
  userEmail: string
): Promise<NextResponse> {
  const existing = await db
    .prepare(
      `SELECT user_id, confirmed_at, cancelled_at, scheduled_at
       FROM account_deletion_requests
       WHERE user_id = ? AND cancelled_at IS NULL`
    )
    .bind(userId)
    .first<DeletionRow>();
  if (existing) {
    return NextResponse.json(
      {
        error: 'Active request exists',
        confirmed: existing.confirmed_at !== null,
        scheduledAt: existing.scheduled_at,
      },
      { status: 409 }
    );
  }

  const tenantId = userId;
  const token = randomUUID();
  const tokenHash = await sha256Hex(token);
  const requestedAt = Math.floor(Date.now() / 1000);
  const scheduledAt = requestedAt + COOLDOWN_DAYS * 24 * 60 * 60;

  await db
    .prepare(
      `INSERT OR REPLACE INTO account_deletion_requests
       (user_id, tenant_id, requested_at, scheduled_at, confirmation_token, confirmation_token_hash, confirmed_at, cancelled_at, created_at)
       VALUES (?, ?, ?, ?, '', ?, NULL, NULL, ?)`
    )
    .bind(userId, tenantId, requestedAt, scheduledAt, tokenHash, requestedAt)
    .run();

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    logger.warn('[acct-delete] NEXT_PUBLIC_APP_URL not set; using fallback');
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const confirmUrl = `${baseUrl}/api/account/delete/confirm?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;

  if (userEmail) {
    try {
      const html = buildDeleteConfirmHtml(confirmUrl, COOLDOWN_DAYS);
      await sendEmail({
        to: userEmail,
        subject: 'Confirm account deletion · Xác nhận xoá tài khoản',
        html,
        tags: [{ name: 'kind', value: 'account-delete-confirm' }],
      });
    } catch (err) {
      logger.error('[acct-delete] template/send failed', toError(err));
      await db
        .prepare(`DELETE FROM account_deletion_requests WHERE user_id = ?`)
        .bind(userId)
        .run();
      return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 502 });
    }
  }

  return NextResponse.json({
    ok: true,
    sentTo: userEmail || null,
    cooldownDays: COOLDOWN_DAYS,
  });
}

export const _internal = { COOLDOWN_DAYS, COOLDOWN_MS };
