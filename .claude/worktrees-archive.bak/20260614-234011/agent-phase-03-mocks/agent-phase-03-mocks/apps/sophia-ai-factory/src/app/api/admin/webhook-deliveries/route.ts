/**
 * GET /api/admin/webhook-deliveries
 *
 * Admin-only outbound webhook delivery snapshot.
 * Returns: endpoint health summary, attempt totals by status, 10 most recent
 * failures (failed + dead_letter) and successes.
 *
 * @module app/api/admin/webhook-deliveries/route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const snapshot = await getWebhookDeliverySnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.warn('[admin/webhook-deliveries] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Webhook query failed' }, { status: 500 });
  }
}
