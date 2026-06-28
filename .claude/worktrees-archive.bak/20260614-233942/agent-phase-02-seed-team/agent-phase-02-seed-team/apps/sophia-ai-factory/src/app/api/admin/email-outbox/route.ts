/**
 * GET /api/admin/email-outbox
 *
 * Admin-only outbox snapshot: status counts + pending due/future + 10 recent
 * failures + 10 recent sends.
 *
 * @module app/api/admin/email-outbox/route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
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
    const snapshot = await getEmailOutboxSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.warn('[admin/email-outbox] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Outbox query failed' }, { status: 500 });
  }
}
