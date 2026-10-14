import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLinkToken } from '@/tree/handover/handover-magic-link';
import { logger } from '@/seed/utils/logger-utility';
import { checkRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import type { RouteParams, AllowedLocale } from './types';
import {
  safeLocale,
  parseInstalledSops,
  fetchHandoverUser,
  consumeAndAuditHandover,
} from './token-validator';
import { issueAndAttachSession } from './session-issuer';

export async function handleGet(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;
  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json({ error: 'Invalid or expired magic link' }, { status: 404 });
  }

  try {
    const userRow = await fetchHandoverUser(handover.customer_user_id);
    return NextResponse.json({
      handoverId: handover.id,
      agencyName: handover.agency_name,
      agencyType: handover.agency_type,
      tier: handover.tier,
      ownerEmail: userRow?.email ?? '',
      ownerFullName: userRow?.name ?? '',
      installedSops: parseInstalledSops(handover.starter_sops),
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

export async function handlePost(request: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const rateLimited = checkRateLimit(request, {
    config: { intervalMs: 60_000, maxRequests: 10 },
    addHeaders: true,
  });
  if (rateLimited) return rateLimited;

  const { token } = await ctx.params;
  let requestLocale: AllowedLocale = 'en';
  try {
    const body = (await request.json()) as Record<string, unknown>;
    requestLocale = safeLocale(body.locale);
  } catch { /* default locale */ }

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json(
      { error: 'Link không hợp lệ hoặc đã hết hạn / Invalid or expired magic link' },
      { status: 404 },
    );
  }

  const consumed = await consumeAndAuditHandover(handover, token);
  if (!consumed) {
    return NextResponse.json(
      { error: 'Link đã được sử dụng / Magic link already consumed' },
      { status: 410 },
    );
  }

  const response = NextResponse.json({
    success: true,
    redirectUrl: `/${requestLocale}/dashboard/onboarding`,
  });

  await issueAndAttachSession(handover, request, response);
  return response;
}
