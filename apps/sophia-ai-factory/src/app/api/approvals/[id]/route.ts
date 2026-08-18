/**
 * /api/approvals/[id] — Approval Resolution REST API
 *
 * PATCH  — Approve or reject an approval
 *
 * Auth: session-based via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getApproval, resolveApproval, getAgentRun } from '@/tree/mission/agent-run-repo';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    // Fetch approval + linked agent run for workspace IDOR check
    const approvalResult = await getApproval(params.id);
    if (!approvalResult.ok) {
      if (approvalResult.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
      }
      return NextResponse.json({ error: approvalResult.error.message }, { status: 500 });
    }

    const approval = approvalResult.value;
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    // agent_approvals has no workspace_id directly — resolve via agent_run_id
    const approvalRow = approval as Record<string, unknown>;
    const agentRunId = String(approvalRow.agent_run_id ?? '');
    if (!agentRunId) {
      return NextResponse.json({ error: 'Approval has no linked agent run' }, { status: 500 });
    }

    const agentRunResult = await getAgentRun(agentRunId);
    if (!agentRunResult.ok || !agentRunResult.value) {
      return NextResponse.json({ error: 'Linked agent run not found' }, { status: 404 });
    }

    // Verify workspace membership + admin role
    const workspaceId = agentRunResult.value.workspaceId;
    const d1 = createServerClient();
    const membership = await d1
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(workspaceId, user.id)
      .first<{ role: string }>();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only workspace owner or admin can resolve approvals' },
        { status: 403 },
      );
    }

    const status = parsed.data.approved ? 'approved' : 'rejected';
    const result = await resolveApproval(params.id, status, user.id, parsed.data.reason);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ status, approvalId: params.id });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}