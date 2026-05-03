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
import { getD1Raw } from '@/lib/db/client';
import { createMagicLinkToken } from '@/lib/handover/handover-magic-link';
import { sendAutoHandoverWelcomeEmail, sendWelcomeEmail } from '@/lib/handover/handover-email-service';
import { generateHandoverDoc } from '@/lib/handover/handover-doc-generator';
import { writeAuditLog } from '@/lib/admin/audit-log';
import { hashEmail } from '@/lib/auth/sign-cookie-value';
import { logger } from '@/lib/utils/logger-utility';
import { checkRateLimit } from '@/middleware/rate-limit-wrapper';
import type { CustomerHandoverRow, AgencyType } from '@/lib/handover/handover-types';
import type { Tier } from '@/types';

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

  const db = await getD1Raw();

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

  // Branch on source: auto_signup uses the lighter promo welcome email;
  // manual handovers re-send the full welcome with handover doc.
  let emailOk = false;
  try {
    if (handover.source === 'auto_signup' || handover.source === 'auto_payment') {
      await sendAutoHandoverWelcomeEmail({
        toEmail: userRow.email,
        ownerFullName: userRow.name,
        tier: handover.tier as Tier,
        locale: 'vi',
        magicLinkUrl,
      });
      emailOk = true;
    } else {
      const installedSops: string[] = handover.starter_sops
        ? (JSON.parse(handover.starter_sops) as string[])
        : [];
      const docMarkdown = generateHandoverDoc({
        customerId: handover.customer_user_id,
        agencyName: handover.agency_name,
        ownerFullName: userRow.name,
        ownerEmail: userRow.email,
        tier: handover.tier as Tier,
        agencyType: (handover.agency_type ?? 'other') as AgencyType,
        locale: 'vi',
        installedSops,
        magicLinkUrl,
        contractDate: new Date(handover.created_at * 1000).toISOString().split('T')[0],
      });
      const r = await sendWelcomeEmail({
        toEmail: userRow.email,
        ownerFullName: userRow.name,
        agencyName: handover.agency_name,
        tier: handover.tier as Tier,
        magicLinkUrl,
        locale: 'vi',
        handoverMarkdown: docMarkdown,
      });
      emailOk = r.success;
    }

    if (emailOk) {
      await db
        .prepare(`UPDATE customer_handovers SET welcome_email_sent_at = ?1 WHERE id = ?2`)
        .bind(Math.floor(Date.now() / 1000), handover.id)
        .run();
    }
  } catch (err) {
    logger.warn('[Welcome/Resend] Email send failed (still 200)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAuditLog({
    actorUserId: userRow.id,
    actionType: 'customer_handover_self_resend',
    targetUserId: userRow.id,
    payload: { handoverId: handover.id, emailHash, source: handover.source, emailSent: emailOk },
  });

  return NextResponse.json({ success: true });
}
