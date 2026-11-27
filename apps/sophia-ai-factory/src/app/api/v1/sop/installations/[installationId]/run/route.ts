/**
 * Authenticated Browser SOP Run Endpoint (Cmd+K Palette)
 *
 * POST /api/v1/sop/installations/[installationId]/run
 *
 * Security:
 * - Session auth via canonical getCurrentUser()
 * - Strict tenant ownership check (inst.userId === user.id)
 * - Rate-limited via withRateLimit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation } from '@/seed/sop/sop-repo-installations';
import { runSop } from '@/forest/missions/sop-runner';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getSopD1 } from '@/seed/sop/d1';
import { waitUntilSopWork } from '@/seed/sop/wait-until';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ installationId: string }> },
): Promise<NextResponse> {
  const { installationId } = await params;
  return withRateLimit(async () => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getSopD1();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const inst = await getInstallation(db, installationId);
    if (!inst || inst.user_id !== user.id) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    if (!inst.enabled) {
      return NextResponse.json({ error: 'Installation disabled' }, { status: 403 });
    }

    const runId = crypto.randomUUID();
    const runPromise = runSop(db, {
      installationId: inst.id,
      runId,
      userId: user.id,
      trigger: 'manual' as const,
      triggerPayload: { source: 'cmd-k', runId },
    });
    waitUntilSopWork(runPromise);

    return NextResponse.json({ ok: true, runId, status: 'queued' }, { status: 202 });
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } })(request);
}
