/**
 * POST /api/distribution — create distribution plan
 * GET  /api/distribution?workspaceId=X&status=Y — list plans
 *
 * Assets are served from /api/distribution/asset.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  createDistributionPlan,
  listDistributionPlans,
} from '@/tree/distribution';
import type { DistributionPlan } from '@/tree/distribution/types';

export const dynamic = 'force-dynamic';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreatePlanBody = z.object({
  workspaceId: z.string().min(1),
  contentProjectId: z.string().min(1),
  title: z.string().min(1).optional(),
  platforms: z.array(z.string().min(1)).optional(),
  scheduledAt: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const VALID_PLAN_STATUSES: readonly DistributionPlan['status'][] = [
  'draft', 'scheduled', 'publishing', 'published', 'failed',
];

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

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreatePlanBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { workspaceId, contentProjectId, platforms, scheduledAt, metadata } = parsed.data;

  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const channels = (platforms ?? []).map((p) => ({
      channel: p,
      assetId: '',
      settings: metadata ?? {},
    }));

    const plan = await createDistributionPlan({
      workspaceId,
      projectId: contentProjectId,
      channels,
      scheduleAt: scheduledAt,
      status: 'draft',
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const status = searchParams.get('status');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  if (status && !VALID_PLAN_STATUSES.includes(status as DistributionPlan['status'])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_PLAN_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const plans = await listDistributionPlans(
      workspaceId,
      (status as DistributionPlan['status']) ?? undefined,
    );
    return NextResponse.json({ plans });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
