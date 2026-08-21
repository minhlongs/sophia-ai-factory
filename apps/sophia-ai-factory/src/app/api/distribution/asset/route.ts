/**
 * POST /api/distribution/asset — create distribution asset
 * GET  /api/distribution/asset?workspaceId=X&planId=Y&platform=Z — list assets
 *
 * Nested asset routes for a specific plan live at /api/distribution/[id]/asset.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  createDistributionAsset,
  listDistributionAssets,
} from '@/tree/distribution';

export const dynamic = 'force-dynamic';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateAssetBody = z.object({
  workspaceId: z.string().min(1),
  planId: z.string().min(1),
  platform: z.string().min(1),
  assetUrl: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

  const parsed = CreateAssetBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { workspaceId, planId, platform, assetUrl, metadata } = parsed.data;

  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const asset = await createDistributionAsset({
      workspaceId,
      planId,
      assetId: assetUrl,
      channel: platform,
      status: 'draft',
      scheduledAt: Math.floor(Date.now() / 1000),
      analytics: metadata ?? {},
    });

    return NextResponse.json({ asset }, { status: 201 });
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
  const planId = searchParams.get('planId') ?? undefined;
  const platform = searchParams.get('platform') ?? undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let assets = await listDistributionAssets(workspaceId, planId);

    if (platform) {
      assets = assets.filter((a) => a.channel === platform);
    }

    return NextResponse.json({ assets });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
