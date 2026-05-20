/**
 * POST /api/sop/installations/[id]/run — trigger a manual SOP run.
 *
 * Creates sop_run record and fires runSop() fire-and-forget.
 * Returns { runId, status: 'queued' } immediately.
 * Auth + ownership check required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation } from '@/lib/sop/sop-repo';
import { runSop } from '@/lib/sop/executor/sop-runner';
import { createRun } from '@/lib/sop/sop-repo-runs';
import { getSopD1 } from '@/lib/sop/d1';
import { waitUntilSopWork } from '@/lib/sop/wait-until';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const inst = await getInstallation(db, id);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inst.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!inst.enabled) return NextResponse.json({ error: 'Installation is disabled' }, { status: 400 });

  const run = await createRun(db, id, 'manual');

  const runCtx = {
    installationId: id,
    runId: run.id,
    userId: user.id,
    trigger: 'manual' as const,
    triggerPayload: {},
  };

  const runPromise = runSop(db, runCtx);
  waitUntilSopWork(runPromise);

  void runPromise.catch(err => {
    logger.error('[sop/run] async run error', err instanceof Error ? err : new Error(String(err)), { installationId: id });
  });

  // Return immediately — client polls for completion
  return NextResponse.json({ status: 'queued', installationId: id, runId: run.id }, { status: 202 });
}
