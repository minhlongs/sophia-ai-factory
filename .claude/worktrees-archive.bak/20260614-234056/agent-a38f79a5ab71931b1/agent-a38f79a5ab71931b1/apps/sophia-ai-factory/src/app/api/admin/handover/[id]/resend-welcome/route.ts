/**
 * POST /api/admin/handover/[id]/resend-welcome
 * Regenerates magic link and resends welcome email to customer.
 *
 * @module app/api/admin/handover/[id]/resend-welcome/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1Raw } from '@/seed/db/client';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { logger } from '@/seed/utils/logger-utility';
import { createMagicLinkToken } from '@/tree/handover/handover-magic-link';
import { sendWelcomeEmail } from '@/tree/handover/handover-email-service';
import { generateHandoverDoc } from '@/tree/handover/handover-doc-generator';
import type { CustomerHandoverRow, AgencyType } from '@/tree/handover/handover-types';
import type { Tier } from '@/seed/types';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { user: admin } = auth;

  const { id } = await params;
  const db = await getD1Raw();

  const handover = await db
    .prepare(`SELECT * FROM customer_handovers WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<CustomerHandoverRow>();

  if (!handover) {
    return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
  }

  // Get user email
  const userRow = await db
    .prepare(`SELECT email, name FROM user WHERE id = ?1 LIMIT 1`)
    .bind(handover.customer_user_id)
    .first<{ email: string; name: string }>();

  if (!userRow) {
    return NextResponse.json({ error: 'Customer user not found' }, { status: 404 });
  }

  // Regenerate magic link
  const token = await createMagicLinkToken(id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const magicLinkUrl = `${baseUrl}/vi/welcome/${token}`;

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

  const emailResult = await sendWelcomeEmail({
    toEmail: userRow.email,
    ownerFullName: userRow.name,
    agencyName: handover.agency_name,
    tier: handover.tier as Tier,
    magicLinkUrl,
    locale: 'vi',
    handoverMarkdown: docMarkdown,
  });

  if (emailResult.success) {
    await db
      .prepare(
        `UPDATE customer_handovers SET welcome_email_sent_at = ?1 WHERE id = ?2`,
      )
      .bind(Math.floor(Date.now() / 1000), id)
      .run();
  }

  await writeAuditLog({
    actorUserId: admin.id,
    actionType: 'customer_handover_resent',
    targetUserId: handover.customer_user_id,
    payload: { event: 'handover_welcome_resent', handoverId: id, emailSent: emailResult.success },
  });

  logger.info('[Handover/Resend] Welcome email resent', { handoverId: id });

  return NextResponse.json({ success: true, magicLinkUrl, emailSent: emailResult.success });
}
