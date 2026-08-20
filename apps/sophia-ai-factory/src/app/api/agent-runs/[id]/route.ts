/**
 * /api/agent-runs/[id] — Single Agent Run REST API
 *
 * GET    — Get agent run status + logs
 * PATCH  — Cancel an agent run
 *
 * Auth: session-based via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getAgentRun, updateAgentRun } from '@/tree/mission/agent-run-repo';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
  reason: z.string().optional(),
});

async function verifyWorkspaceAccess(workspaceId: string | undefined, userId: string): Promise<boolean> {
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
    const result = await getAgentRun(id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    const run = result.value;
    if (!run) {
      return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
    }

    // IDOR: verify user has access to the workspace that owns this run
    const hasAccess = await verifyWorkspaceAccess(run.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ agentRun: run });
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
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    // Verify run exists + user has workspace access before cancelling
    const existing = await getAgentRun(id);
    if (!existing.ok) {
      if (existing.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
      }
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }

    const run = existing.value;
    if (!run) {
      return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(run.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cancelResult = await updateAgentRun(id, {
      status: 'cancelled',
      phase: 'cancelled',
      errorMessage: parsed.data.reason ?? 'Cancelled by user',
    });

    if (!cancelResult.ok) {
      return NextResponse.json({ error: cancelResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'cancelled', agentRunId: id });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}