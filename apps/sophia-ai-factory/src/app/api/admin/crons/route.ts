/**
 * GET /api/admin/crons
 *
 * Admin-only cron run monitor. Lists every scheduled job's last execution
 * with status + run count + age.
 *
 * @module app/api/admin/crons/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth; // eslint-disable-line @typescript-eslint/no-unused-vars

  try {
    const crons = await listCronRunSummaries();
    return NextResponse.json({ count: crons.length, crons });
  } catch (err) {
    logger.warn('[admin/crons] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Cron query failed' }, { status: 500 });
  }
}
