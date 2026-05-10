/**
 * POST /api/account/delete/request
 * Wave 21 Phase 02: account self-delete stage 1 (email confirmation).
 *
 * Body: { action: 'request' | 'cancel' }
 *  - 'request' (default): create deletion request, mail confirmation link
 *  - 'cancel': mark active request as cancelled (allowed any time before scheduled_at)
 *
 * @module app/api/account/delete/request/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { sendEmail } from '@/forest/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { buildDeleteConfirmHtml } from './email-template';

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  action: z.enum(['request', 'cancel']).default('request'),
});

interface DeletionRow {
  user_id: string;
  confirmed_at: number | null;
  cancelled_at: number | null;
  scheduled_at: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await req.json().catch(() => ({}));
    parsed = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', details: err instanceof Error ? err.message : 'unknown' },
      { status: 400 },
    );
  }

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[acct-delete] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  if (parsed.action === 'cancel') {
    return cancelRequest(db, user.id);
  }

  return createRequest(db, user.id, user.email ?? '');
}

async function cancelRequest(db: D1Database, userId: string): Promise<NextResponse> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `UPDATE account_deletion_requests
       SET cancelled_at = ?
       WHERE user_id = ? AND cancelled_at IS NULL`,
    )
    .bind(now, userId)
    .run();
  const changes = result.meta?.changes ?? 0;
  if (changes === 0) {
    return NextResponse.json({ error: 'No active deletion request' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, cancelled: true });
}

async function createRequest(
  db: D1Database,
  userId: string,
  userEmail: string,
): Promise<NextResponse> {
  // Block if already an active (un-cancelled) request exists
  const existing = await db
    .prepare(
      `SELECT user_id, confirmed_at, cancelled_at, scheduled_at
       FROM account_deletion_requests
       WHERE user_id = ? AND cancelled_at IS NULL`,
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
      { status: 409 },
    );
  }

  const tenantId = userId; // tenantId mirrors userId for FREE100
  const token = randomUUID();
  const requestedAt = Math.floor(Date.now() / 1000);
  const scheduledAt = requestedAt + COOLDOWN_DAYS * 24 * 60 * 60;

  await db
    .prepare(
      `INSERT OR REPLACE INTO account_deletion_requests
       (user_id, tenant_id, requested_at, scheduled_at, confirmation_token, confirmed_at, cancelled_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .bind(userId, tenantId, requestedAt, scheduledAt, token, requestedAt)
    .run();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const confirmUrl = `${baseUrl}/api/account/delete/confirm?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;

  if (userEmail) {
    try {
      await sendEmail({
        to: userEmail,
        subject: 'Confirm account deletion · Xác nhận xoá tài khoản',
        html: buildDeleteConfirmHtml(confirmUrl, COOLDOWN_DAYS),
        tags: [{ name: 'kind', value: 'account-delete-confirm' }],
      });
    } catch (err) {
      logger.error('[acct-delete] sendEmail failed', toError(err));
      // Roll back the row so user can retry
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
