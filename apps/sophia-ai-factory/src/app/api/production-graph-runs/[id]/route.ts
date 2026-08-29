/**
 * /api/production-graph-runs/[id] — Production Graph Run REST API
 *
 * GET   — Get production graph run status + node states
 * PATCH — Cancel a production graph run
 *
 * Cancellation flow: the PATCH flips the run row to 'cancelled' via a
 * guarded UPDATE (only from queued/running/awaiting_approval). The
 * in-flight production-graph-runner Inngest function observes the new
 * status at the next node boundary and emits production.graph.cancelled.
 *
 * Auth: session-based via getCurrentUser(); workspace membership verified
 * against org_members to prevent IDOR.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getRun, cancelProductionGraphRun } from '@/tree/production-graph/repo';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Statuses a run may be cancelled from. Terminal states reject the call. */
const CANCELLABLE_STATUSES = new Set(['queued', 'running', 'awaiting_approval']);

async function verifyWorkspaceAccess(
  workspaceId: string | undefined,
  userId: string,
): Promise<boolean> {
  if (!workspaceId) return false;
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await getRun(id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    const run = result.value;
    if (!run) {
      return NextResponse.json({ error: 'Production graph run not found' }, { status: 404 });
    }

    // IDOR guard: only workspace members may read the run.
    const hasAccess = await verifyWorkspaceAccess(run.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ graphRun: run });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Validate body (empty body allowed — reason is optional).
    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    // Load run to authorize before any mutation.
    const existing = await getRun(id);
    if (!existing.ok) {
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }
    const run = existing.value;
    if (!run) {
      return NextResponse.json({ error: 'Production graph run not found' }, { status: 404 });
    }

    // IDOR guard: only workspace members may cancel the run.
    const hasAccess = await verifyWorkspaceAccess(run.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!CANCELLABLE_STATUSES.has(run.status)) {
      return NextResponse.json(
        {
          error: 'Run is already in a terminal state',
          status: run.status,
        },
        { status: 409 },
      );
    }

    // Guarded cancel: the runner may flip the row concurrently — the
    // per-status guard makes the race safe without transactions.
    const guardStatus = run.status as 'queued' | 'running' | 'awaiting_approval';
    const cancel = await cancelProductionGraphRun(id, guardStatus, parsed.data.reason);
    if (!cancel.ok) {
      return NextResponse.json({ error: cancel.error.message }, { status: 500 });
    }

    if (!cancel.value.flipped) {
      // Row moved between our read and the guarded update — re-read to report.
      const reread = await getRun(id);
      const currentStatus = reread.ok && reread.value ? reread.value.status : 'unknown';
      return NextResponse.json(
        {
          error: 'Run state changed during cancellation; retry',
          status: currentStatus,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ status: 'cancelled', graphRunId: id });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
