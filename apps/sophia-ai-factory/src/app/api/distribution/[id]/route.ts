/**
 * GET  /api/distribution/[id] — fetch single distribution plan
 * PATCH /api/distribution/[id] — update plan status
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  getDistributionPlan,
  updateDistributionPlanStatus,
  isValidPlanTransition,
} from '@/tree/distribution';
import type { DistributionPlan } from '@/tree/distribution/types';

export const dynamic = 'force-dynamic';

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_PLAN_STATUSES: readonly DistributionPlan['status'][] = [
  'draft', 'scheduled', 'publishing', 'published', 'failed',
];

const PatchBody = z.object({
  status: z.enum(VALID_PLAN_STATUSES as unknown as [string, ...string[]]),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const d1 = createServerClient();
  const row = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return row !== null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function lookupWorkspaceId(planId: string): Promise<string | null> {
  const d1 = createServerClient();
  const row = await d1
    .prepare('SELECT workspace_id FROM distribution_plans WHERE id = ?')
    .bind(planId)
    .first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const workspaceId = await lookupWorkspaceId(id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plan = await getDistributionPlan(id, workspaceId);
    return NextResponse.json({ plan });
  } catch (err) {
    const msg = getErrorMessage(err);
    const status = msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;

    const workspaceId = await lookupWorkspaceId(id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await getDistributionPlan(id, workspaceId);
    const newStatus = parsed.data.status as DistributionPlan['status'];

    if (!isValidPlanTransition(existing.status, newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${existing.status} to ${newStatus}` },
        { status: 400 },
      );
    }

    const updated = await updateDistributionPlanStatus(id, newStatus, workspaceId);
    return NextResponse.json({ plan: updated });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
