/**
 * GET /api/sop/runs/[runId] — fetch single run with ownership check.
 *
 * Verifies run belongs to user via installation ownership.
 * Used by client polling for status updates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation } from '@/lib/sop/sop-repo';
import type { SopRunRow } from '@/lib/sop/sop-types';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { runId } = await params;
  const db = getD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const run = await db
    .prepare(`SELECT * FROM sop_runs WHERE id = ?1 LIMIT 1`)
    .bind(runId)
    .first<SopRunRow>();

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ownership: run.installation_id → installation.user_id
  const inst = await getInstallation(db, run.installation_id);
  if (!inst || inst.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse mission_ids
  let missionIds: string[] = [];
  try { missionIds = JSON.parse(run.mission_ids) as string[]; } catch { /* empty */ }

  return NextResponse.json({ run: { ...run, missionIds } });
}
