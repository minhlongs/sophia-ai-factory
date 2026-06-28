/**
 * GET /api/admin/crons
 *
 * Admin-only cron run monitor. Lists every scheduled job's last execution
 * with status + run count + age.
 *
 * @module app/api/admin/crons/route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
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
    const crons = await listCronRunSummaries();
    return NextResponse.json({ count: crons.length, crons });
  } catch (err) {
    logger.warn('[admin/crons] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Cron query failed' }, { status: 500 });
  }
}
