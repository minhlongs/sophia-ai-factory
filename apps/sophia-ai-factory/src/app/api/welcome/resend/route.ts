/**
 * POST /api/welcome/resend
 * Self-service magic link regeneration. No auth required (the email IS the auth).
 *
 * Body: { email: string }
 *
 * Rate-limited: 2 requests per HOUR per email + IP combination, to block abuse
 * without locking out legitimate retries (mobile users, network flakiness).
 *
 * Returns 200 with `{ success: true }` whether the email exists or not — never
 * leak account existence. Email delivery happens out-of-band; if no handover
 * row matches, the request is silently ignored.
 *
 * @module app/api/welcome/resend/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getD1 } from '@/seed/db/client';
import { createMagicLinkToken } from '@/tree/handover/handover-magic-link';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { hashEmail } from '@/seed/auth/sign-cookie-value';
import { logger } from '@/seed/utils/logger-utility';
import { checkRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import type { CustomerHandoverRow } from '@/tree/handover/handover-types';
import { deliverHandoverWelcomeEmail } from './welcome-resend-delivery';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().max(200),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Body parse
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Rate limit: combine IP + email so spamming many emails from one IP
  // and many IPs against one email both hit the cap.
  const emailHash = await hashEmail(body.email);
  const rateLimited = checkRateLimit(request, {
    config: { intervalMs: 60 * 60 * 1000, maxRequests: 2 },
    key: `welcome-resend:${emailHash}`,
    addHeaders: true,
  });
  if (rateLimited) return rateLimited;

  const _db = await getD1();
  if (!_db) {
    logger.error('[Welcome/Resend] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const db = _db;

  // Look up user → most recent handover
  const userRow = await db
    .prepare(`SELECT id, email, name FROM user WHERE email = ?1 LIMIT 1`)
    .bind(body.email)
    .first<{ id: string; email: string; name: string }>();

  // Always 200 — never leak account existence
  if (!userRow) {
    logger.info('[Welcome/Resend] Unknown email (silent OK)', { emailHash });
    return NextResponse.json({ success: true });
  }

  const handover = await db
    .prepare(
      `SELECT * FROM customer_handovers
        WHERE customer_user_id = ?1
        ORDER BY created_at DESC
        LIMIT 1`,
    )
    .bind(userRow.id)
    .first<CustomerHandoverRow>();

  if (!handover) {
    logger.info('[Welcome/Resend] User has no handover row (silent OK)', { emailHash });
    return NextResponse.json({ success: true });
  }

  // Regen token (72h for auto_signup, 24h otherwise)
  const token = await createMagicLinkToken(handover.id, { source: handover.source });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const magicLinkUrl = `${baseUrl}/vi/welcome/${token}`;

  const emailOk = await deliverHandoverWelcomeEmail({
    db,
    userRow,
    handover,
    magicLinkUrl,
  });

  await writeAuditLog({
    actorUserId: userRow.id,
    actionType: 'customer_handover_self_resend',
    targetUserId: userRow.id,
    payload: { handoverId: handover.id, emailHash, source: handover.source, emailSent: emailOk },
  });

  return NextResponse.json({ success: true });
}
