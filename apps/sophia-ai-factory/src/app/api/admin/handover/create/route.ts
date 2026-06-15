/**
 * POST /api/admin/handover/create
 * Creates a new customer account, sets tier, pre-installs SOPs,
 * generates magic link, sends welcome email.
 *
 * @module app/api/admin/handover/create/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { createMagicLinkToken } from '@/tree/handover/handover-magic-link';
import { sendWelcomeEmail } from '@/tree/handover/handover-email-service';
import { generateHandoverDoc } from '@/tree/handover/handover-doc-generator';
import { createCustomerUser, upsertUserTier, preInstallSops, createHandoverRecord } from '@/tree/handover/handover-account-setup';
import type { AgencyType } from '@/tree/handover/handover-types';
import type { Tier } from '@/seed/types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  agencyName: z.string().min(1).max(200),
  ownerEmail: z.string().email(),
  ownerFullName: z.string().min(1).max(200),
  agencyType: z.enum(['b2b_saas', 'ecom', 'content_creator', 'service', 'other']),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']),
  phone: z.string().max(30).optional(),
  locale: z.string().max(10).optional().default('vi'),
  timezone: z.string().max(50).optional().default('Asia/Ho_Chi_Minh'),
  referralSource: z.string().max(200).optional(),
  selectedSops: z.array(z.string().max(100)).max(25),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user: admin } = auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: getErrorMessage(err) }, { status: 400 });
  }

  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  // Check duplicate email
  const existing = await db
    .prepare(`SELECT id FROM user WHERE email = ?1 LIMIT 1`)
    .bind(body.ownerEmail)
    .first<{ id: string }>();
  if (existing) {
    return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
  }

  // Create user, tier, SOPs, handover record
  let userId: string;
  try {
    userId = await createCustomerUser(db, body.ownerEmail, body.ownerFullName);
  } catch (err) {
    logger.error('[Handover/Create] User insert failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
  }

  await upsertUserTier(db, userId, body.tier);
  const installedSops = await preInstallSops(db, userId, body.selectedSops);

  let handoverId: string;
  try {
    handoverId = await createHandoverRecord(db, {
      userId, agencyName: body.agencyName, agencyType: body.agencyType,
      tier: body.tier, installedSops, adminId: admin.id,
    });
  } catch (err) {
    logger.error('[Handover/Create] Handover row insert failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Failed to create handover record' }, { status: 500 });
  }

  // Generate magic link + handover doc
  const token = await createMagicLinkToken(handoverId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const magicLinkUrl = `${baseUrl}/${body.locale}/welcome/${token}`;

  const docMarkdown = generateHandoverDoc({
    customerId: userId, agencyName: body.agencyName, ownerFullName: body.ownerFullName,
    ownerEmail: body.ownerEmail, tier: body.tier as Tier, agencyType: body.agencyType as AgencyType,
    locale: body.locale, installedSops, magicLinkUrl,
    contractDate: new Date().toISOString().split('T')[0],
  });

  // Send welcome email
  const emailResult = await sendWelcomeEmail({
    toEmail: body.ownerEmail, ownerFullName: body.ownerFullName, agencyName: body.agencyName,
    tier: body.tier as Tier, magicLinkUrl, locale: body.locale, handoverMarkdown: docMarkdown,
  });

  if (emailResult.success) {
    await db
      .prepare(`UPDATE customer_handovers SET welcome_email_sent_at = ?1 WHERE id = ?2`)
      .bind(Math.floor(Date.now() / 1000), handoverId)
      .run();
  }

  await writeAuditLog({
    actorUserId: admin.id, actionType: 'customer_handover_created', targetUserId: userId,
    payload: { handoverId, agencyName: body.agencyName, tier: body.tier, sopCount: installedSops.length, emailSent: emailResult.success },
  });

  logger.info('[Handover/Create] Customer handover created', { handoverId, userId, tier: body.tier });

  return NextResponse.json({
    success: true, handoverId, customerId: userId, magicLinkUrl,
    magicLinkToken: token, installedSops, emailSent: emailResult.success, handoverDoc: docMarkdown,
  });
}
