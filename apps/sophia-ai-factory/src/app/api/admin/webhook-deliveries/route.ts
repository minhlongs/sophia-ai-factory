/**
 * GET /api/admin/webhook-deliveries
 *
 * Admin-only outbound webhook delivery snapshot.
 * Returns: endpoint health summary, attempt totals by status, 10 most recent
 * failures (failed + dead_letter) and successes.
 *
 * @module app/api/admin/webhook-deliveries/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const snapshot = await getWebhookDeliverySnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.warn('[admin/webhook-deliveries] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Webhook query failed' }, { status: 500 });
  }
}
