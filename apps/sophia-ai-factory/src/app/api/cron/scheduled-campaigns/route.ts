import { NextRequest, NextResponse } from 'next/server';
import { getD1Safe } from '@/seed/db/client';
import { wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
} from '@/seed/observability/cron-check-in';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  handlePlaybookCron,
  handleLegacyCron,
} from './modules';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = await getD1Safe();

  if (d1 && (await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS))) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  const today = new Date().toISOString().split('T')[0];

  const url = req.nextUrl ?? new URL(req.url);
  const isPlaybookEngine =
    url.searchParams.get('engine') === 'playbook' ||
    req.headers.get('x-campaign-engine') === 'playbook';

  if (isPlaybookEngine) {
    return handlePlaybookCron(today, d1, cronCtx);
  }

  return handleLegacyCron(today, d1, cronCtx);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
