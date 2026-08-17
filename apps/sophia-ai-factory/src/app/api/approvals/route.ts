/**
 * GET /api/approvals
 * List pending approvals for the user's workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Find workspace(s) the user belongs to
    const memberships = await d1
      .prepare(
        'SELECT org_id, role FROM org_members WHERE user_id = ? ORDER BY created_at ASC'
      )
      .bind(user.id)
      .all<{ org_id: string; role: string }>();

    const workspaceIds = (memberships.results ?? []).map((m) => m.org_id);
    if (workspaceIds.length === 0) {
      return NextResponse.json({
        approvals: [],
        count: 0,
        limit,
        offset,
        workspaces: [],
      });
    }

    // Gather pending approvals for all accessible workspaces
    const placeholders = workspaceIds.map(() => '?').join(',');
    const rows = await d1
      .prepare(
        `SELECT aa.*, ar.agent_id, ar.mission_id, ar.workspace_id
         FROM agent_approvals aa
         JOIN agent_runs ar ON aa.agent_run_id = ar.id
         WHERE ar.workspace_id IN (${placeholders}) AND aa.status = 'pending'
         ORDER BY aa.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...workspaceIds, limit, offset)
      .all<Record<string, unknown>>();

    const approvals = (rows.results ?? []).map((row) => ({
      id: row.id as string,
      agentRunId: row.agent_run_id as string,
      actionId: row.action_id as string,
      actionType: row.action_type as string,
      actionSummary: row.action_summary as string,
      estimatedCostCents: row.estimated_cost_cents as number | null,
      status: row.status as string,
      createdAt: row.created_at as number,
      timeoutAt: row.timeout_at as number,
      agentId: row.agent_id as string,
      missionId: row.mission_id as string | null,
      workspaceId: row.workspace_id as string,
    }));

    logger.info('[api/approvals] Listed pending approvals', {
      userId: user.id,
      count: approvals.length,
    });

    return NextResponse.json({
      approvals,
      count: approvals.length,
      limit,
      offset,
      workspaces: workspaceIds,
    });
  } catch (error) {
    logger.error('[api/approvals] GET failed', {
      error: toError(error).message,
    });
    return NextResponse.json(
      { error: 'Failed to list approvals', details: toError(error).message },
      { status: 500 }
    );
  }
}