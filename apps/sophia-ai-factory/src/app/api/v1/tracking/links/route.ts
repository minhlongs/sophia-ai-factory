/**
 * /api/v1/tracking/links
 *
 * POST — Create a new tracking link (tenant-scoped)
 * GET  — List tracking links for current user/tenant
 *
 * Auth: getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createTrackingLink } from '@/land/tracking/edge-link';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { errorResponse } from '@/seed/api';

export const dynamic = 'force-dynamic';

const CreateLinkSchema = z.object({
  destinationUrl: z.string().url(),
  affiliateId: z.string().optional(),
  campaignId: z.string().optional(),
});

export const POST = withRateLimit(async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid request body', 'VALIDATION_ERROR', 422);
  }

  try {
    const result = await createTrackingLink({
      tenantId: user.id,
      destinationUrl: parsed.data.destinationUrl,
      affiliateId: parsed.data.affiliateId,
      campaignId: parsed.data.campaignId,
    });

    return NextResponse.json({ id: result.id, shortUrl: result.shortUrl }, { status: 201 });
  } catch (err) {
    logger.error('[tracking] Create link failed', err instanceof Error ? err : new Error(String(err)), {
      userId: user.id,
    });
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } });

export const GET = withRateLimit(async function GET(_request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('tracking_links')
      .select('id,destination_url,affiliate_id,campaign_id,active,created_at')
      .eq('tenant_id', user.id);

    if (error) throw new Error(error.message ?? 'DB error');

    const rows = (data ?? []) as Array<{
      id: string;
      destination_url: string;
      affiliate_id: string | null;
      campaign_id: string | null;
      active: number;
      created_at: string;
    }>;

    return NextResponse.json({
      links: rows.map((r) => ({
        id: r.id,
        destinationUrl: r.destination_url,
        affiliateId: r.affiliate_id,
        campaignId: r.campaign_id,
        active: r.active === 1,
        createdAt: r.created_at,
        shortUrl: `https://track.sophia.agencyos.network/r/${r.id}`,
      })),
    });
  } catch (err) {
    logger.error('[tracking] List links failed', err instanceof Error ? err : new Error(String(err)), {
      userId: user.id,
    });
    return NextResponse.json({ error: 'Failed to list links' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });
