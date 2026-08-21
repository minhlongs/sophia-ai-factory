/**
 * POST /api/content-graph/asset — create content asset
 * GET  /api/content-graph/asset?workspaceId=X&projectId=Y — list assets
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { createAsset, listAssets, newAssetId } from '@/tree/content-graph';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ContentStatus, ContentAsset } from '@/seed/types/creative-domain';

export const dynamic = 'force-dynamic';

const ASSET_TYPES: ContentAsset['type'][] = ['script', 'storyboard', 'audio', 'video', 'image', 'subtitle', 'thumbnail'];
const CONTENT_STATUSES: ContentStatus[] = ['draft', 'planned', 'in_production', 'review', 'approved', 'published', 'archived'];

const createAssetSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum(ASSET_TYPES as [string, ...string[]]),
  title: z.string().min(1),
  status: z.enum(CONTENT_STATUSES as [string, ...string[]]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  const { workspaceId, projectId, type, title, status, metadata } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const asset = await createAsset({
      id: newAssetId(),
      workspaceId,
      projectId,
      type: type as ContentAsset['type'],
      status: (status as ContentStatus) ?? 'draft',
      metadata: { ...(metadata ?? {}), title },
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const workspaceId = sp.get('workspaceId');
  const projectId = sp.get('projectId');
  if (!workspaceId || !projectId) {
    return NextResponse.json({ error: 'workspaceId and projectId are required' }, { status: 400 });
  }

  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const assets = await listAssets(projectId);
    return NextResponse.json({ assets });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}