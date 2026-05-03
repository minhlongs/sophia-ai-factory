/**
 * POST /api/sop/installations/[id]/run — trigger a manual SOP run.
 *
 * Creates sop_run record and fires runSop() fire-and-forget.
 * Returns { runId, status: 'queued' } immediately.
 * Auth + ownership check required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { getInstallation } from '@/lib/sop/sop-repo';
import { runSop } from '@/lib/sop/executor/sop-runner';
import { logger } from '@/lib/utils/logger-utility';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const inst = await getInstallation(db, id);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inst.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!inst.enabled) return NextResponse.json({ error: 'Installation is disabled' }, { status: 400 });

  const runCtx = {
    installationId: id,
    runId: '',
    userId: user.id,
    trigger: 'manual' as const,
    triggerPayload: {},
  };

  // Fire-and-forget — return runId from async result once created
  const runPromise = runSop(db, runCtx);

  void runPromise.catch(err => {
    logger.error('[sop/run] async run error', err instanceof Error ? err : new Error(String(err)), { installationId: id });
  });

  // Return immediately — client polls for completion
  return NextResponse.json({ status: 'queued', installationId: id }, { status: 202 });
}
