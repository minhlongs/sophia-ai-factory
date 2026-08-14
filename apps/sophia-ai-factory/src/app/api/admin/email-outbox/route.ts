/**
 * GET /api/admin/email-outbox
 *
 * Admin-only outbox snapshot: status counts + pending due/future + 10 recent
 * failures + 10 recent sends.
 *
 * @module app/api/admin/email-outbox/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth; // eslint-disable-line @typescript-eslint/no-unused-vars

  try {
    const snapshot = await getEmailOutboxSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.warn('[admin/email-outbox] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Outbox query failed' }, { status: 500 });
  }
}
