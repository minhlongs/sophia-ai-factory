/**
 * Cancellation and body validation helpers for /api/production-graph-runs/[id].
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getRun, cancelProductionGraphRun } from '@/tree/production-graph/repo';

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Statuses a run may be cancelled from. Terminal states reject the call. */
const CANCELLABLE_STATUSES = new Set(['queued', 'running', 'awaiting_approval']);

export async function parseCancelBody(
  request: NextRequest,
): Promise<{ ok: true; reason?: string } | { ok: false; response: NextResponse }> {
  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      ),
    };
  }
  return { ok: true, reason: parsed.data.reason };
}

export async function executeGuardedRunCancellation(
  id: string,
  userId: string,
  reason?: string,
): Promise<NextResponse> {
  const existing = await getRun(id);
  if (!existing.ok) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  const run = existing.value;
  if (!run) {
    return NextResponse.json({ error: 'Production graph run not found' }, { status: 404 });
  }

  const hasAccess = await verifyWorkspaceAccess(run.workspaceId, userId);
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

  const guardStatus = run.status as 'queued' | 'running' | 'awaiting_approval';
  const cancel = await cancelProductionGraphRun(id, guardStatus, reason);
  if (!cancel.ok) {
    return NextResponse.json({ error: cancel.error.message }, { status: 500 });
  }

  if (!cancel.value.flipped) {
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
}
