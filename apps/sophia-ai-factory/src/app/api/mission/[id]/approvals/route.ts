/**
 * GET  /api/mission/[id]/approvals?workspaceId=X — list pending approvals
 * POST /api/mission/[id]/approvals — resolve an approval
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { listPendingApprovals, resolveApproval } from '@/tree/mission';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

const ResolveApprovalSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  approvalId: z.string().min(1, 'approvalId is required'),
  approved: z.boolean(),
  reason: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;
  const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : 0;

  const result = await listPendingApprovals(workspaceId, limit, offset);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.value);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ResolveApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = parsed.data.approved ? 'approved' : 'rejected';
  const result = await resolveApproval(
    parsed.data.approvalId,
    status,
    user.id,
    parsed.data.reason,
    parsed.data.workspaceId
  );
  if (!result.ok) {
    const code = result.error.code;
    const httpStatus = code === 'NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : code === 'ALREADY_RESOLVED' ? 409 : 500;
    return NextResponse.json({ error: result.error.message }, { status: httpStatus });
  }

  return NextResponse.json(result.value);
}