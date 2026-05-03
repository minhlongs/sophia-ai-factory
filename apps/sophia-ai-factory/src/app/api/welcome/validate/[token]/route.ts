/**
 * GET /api/welcome/validate/[token]
 * Validates magic link token and returns handover data for welcome page.
 * POST: consumes token (marks first login).
 *
 * @module app/api/welcome/validate/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLinkToken, consumeMagicLink } from '@/lib/handover/handover-magic-link';
import { getD1Raw } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { CustomerHandoverRow } from '@/lib/handover/handover-types';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json({ error: 'Invalid or expired magic link' }, { status: 404 });
  }

  try {
    const db = await getD1Raw();
    const userRow = await db
      .prepare(`SELECT email, name FROM users WHERE id = ?1 LIMIT 1`)
      .bind(handover.customer_user_id)
      .first<{ email: string; name: string }>();

    const installedSops: string[] = handover.starter_sops
      ? (JSON.parse(handover.starter_sops) as string[])
      : [];

    return NextResponse.json({
      handoverId: handover.id,
      agencyName: handover.agency_name,
      agencyType: handover.agency_type,
      tier: handover.tier,
      ownerEmail: userRow?.email ?? '',
      ownerFullName: userRow?.name ?? '',
      installedSops,
      firstLoginAt: handover.customer_first_login_at,
      firstSopInstallAt: handover.customer_first_sop_install_at,
      firstRunAt: handover.customer_first_run_at,
      status: handover.status,
    });
  } catch (err) {
    logger.error('[Welcome/Validate] DB error', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json({ error: 'Invalid or expired magic link' }, { status: 404 });
  }

  await consumeMagicLink(handover.id);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';

  logger.info('[Welcome/Consume] Magic link consumed', { handoverId: handover.id });

  return NextResponse.json({
    success: true,
    redirectUrl: `${baseUrl}/dashboard`,
    customerEmail: '',
  });
}
