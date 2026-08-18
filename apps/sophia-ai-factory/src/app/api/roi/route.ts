/**
 * GET /api/roi — Workspace ROI overview
 * POST /api/roi — Record a new ROI entry
 *
 * Phase 4: Creative Learning Loop
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getWorkspaceROI, getTopROIChannels, recordROI } from '@/tree/roi';

export const dynamic = 'force-dynamic';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

const recordSchema = z.object({
  workspaceId: z.string().min(1),
  entityType: z.enum(['mission', 'asset', 'campaign']),
  entityId: z.string().min(1),
  revenueCents: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative().default(0),
  channel: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const since = searchParams.get('since') ? Number(searchParams.get('since')) : undefined;

    const [aggregate, topChannels] = await Promise.all([
      getWorkspaceROI(workspaceId, { since }),
      getTopROIChannels(workspaceId, 10, since),
    ]);

    return NextResponse.json({
      aggregate: aggregate ?? { workspaceId, totalRevenueCents: 0, totalCostCents: 0, roi: 0, unitCount: 0, avgRevenuePerUnit: 0, avgCostPerUnit: 0 },
      topChannels,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = recordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await recordROI({
      workspaceId: parsed.data.workspaceId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      revenueCents: parsed.data.revenueCents,
      costCents: parsed.data.costCents,
      channel: parsed.data.channel,
      recordedAt: Date.now(),
    });

    return NextResponse.json({ id: `roi_${result.entityId}`, roi: result.roi }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}