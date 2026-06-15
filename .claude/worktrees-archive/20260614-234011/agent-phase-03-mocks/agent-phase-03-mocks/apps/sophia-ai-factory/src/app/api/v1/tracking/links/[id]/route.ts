/**
 * /api/v1/tracking/links/[id]
 *
 * GET    — Get tracking link detail with click count
 * DELETE — Soft-delete (set active=0)
 *
 * Auth: getCurrentUser() — tenant isolation enforced
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTrackingLink } from '@/land/tracking/edge-link';
import { getD1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const link = await getTrackingLink(user.id, id);
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    let clickCount = 0;
    try {
      const db = await getD1Client();
      const { data: clicks } = await db
        .from('tracking_clicks')
        .select('id')
        .eq('link_id', id);
      clickCount = (clicks as unknown[])?.length ?? 0;
    } catch { /* non-fatal */ }

    return NextResponse.json({ ...link, clickCount });
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(_request);
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const link = await getTrackingLink(user.id, id);
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    try {
      const db = await getD1Client();
      await db
        .from('tracking_links')
        .update({ active: 0 })
        .eq('id', id)
        .eq('tenant_id', user.id);

      return NextResponse.json({ success: true });
    } catch (err) {
      logger.error('[tracking] Delete link failed', err instanceof Error ? err : new Error(String(err)), {
        userId: user.id,
        linkId: id,
      });
      return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(_request);
}
