/**
 * GET  /api/approvals/[id] — fetch approval by ID (auth + workspace check)
 * PATCH /api/approvals/[id] — resolve approval (auth + workspace owner/admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getAuthUser(request: NextRequest) {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

async function verifyWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;
  const row = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return Boolean(row);
}

async function verifyAdminAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const d1 = getD1();
  if (!d1) return false;
  const row = await d1
    .prepare(
      'SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND role IN (?, ?)'
    )
    .bind(workspaceId, userId, 'admin', 'owner')
    .first();
  return Boolean(row);
}

// ─── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getAuthUser(request);
    if (user instanceof Response) return user;

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const row = await d1
      .prepare('SELECT * FROM agent_approvals WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    // Resolve workspace via agent_run
    const agentRun = await d1
      .prepare('SELECT workspace_id FROM agent_runs WHERE id = ?')
      .bind(row.agent_run_id as string)
      .first<{ workspace_id: string }>();

    if (!agentRun) {
      return NextResponse.json(
        { error: 'Agent run not found for this approval' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyWorkspaceAccess(user.id, agentRun.workspace_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: no access to this workspace' },
        { status: 403 }
      );
    }

    return NextResponse.json({ approval: row });
  } catch (error) {
    logger.error('[api/approvals/[id]] GET failed', {
      error: toError(error).message,
    });
    return NextResponse.json(
      { error: 'Failed to fetch approval', details: toError(error).message },
      { status: 500 }
    );
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────

const resolveApprovalSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getAuthUser(request);
    if (user instanceof Response) return user;

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const parsed = resolveApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const approval = await d1
      .prepare('SELECT * FROM agent_approvals WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: `Approval already ${approval.status}` },
        { status: 409 }
      );
    }

    // Resolve workspace via agent_run
    const agentRun = await d1
      .prepare('SELECT workspace_id FROM agent_runs WHERE id = ?')
      .bind(approval.agent_run_id as string)
      .first<{ workspace_id: string }>();

    if (!agentRun) {
      return NextResponse.json(
        { error: 'Agent run not found for this approval' },
        { status: 404 }
      );
    }

    const isAdmin = await verifyAdminAccess(user.id, agentRun.workspace_id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: only workspace owner or admin can resolve approvals' },
        { status: 403 }
      );
    }

    const status = parsed.data.approved ? 'approved' : 'rejected';
    const now = Math.floor(Date.now() / 1000);
    await d1
      .prepare(
        'UPDATE agent_approvals SET status = ?, reviewer_id = ?, comment = ?, resolved_at = ? WHERE id = ?'
      )
      .bind(status, user.id, parsed.data.reason ?? null, now, id)
      .run();

    const updated = await d1
      .prepare('SELECT * FROM agent_approvals WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    logger.info('[api/approvals/[id]] Approval resolved', {
      approvalId: id,
      status,
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      status,
      approval: updated,
    });
  } catch (error) {
    logger.error('[api/approvals/[id]] PATCH failed', {
      error: toError(error).message,
    });
    return NextResponse.json(
      { error: 'Failed to resolve approval', details: toError(error).message },
      { status: 500 }
    );
  }
}