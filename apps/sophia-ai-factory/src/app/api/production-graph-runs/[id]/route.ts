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
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getRun } from '@/tree/production-graph/repo';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  executeGuardedRunCancellation,
  parseCancelBody,
} from './run-cancel-helpers';

export const dynamic = 'force-dynamic';

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
    const bodyResult = await parseCancelBody(request);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    return executeGuardedRunCancellation(id, user.id, bodyResult.reason);
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
