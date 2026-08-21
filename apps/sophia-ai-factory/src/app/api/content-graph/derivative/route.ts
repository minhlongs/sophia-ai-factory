/**
 * POST /api/content-graph/derivative — create derivative asset
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { createDerivative, newAssetId } from '@/tree/content-graph';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const createDerivativeSchema = z.object({
  workspaceId: z.string().min(1),
  sourceAssetId: z.string().min(1),
  derivativeAssetId: z.string().min(1),
  relationshipType: z.string().optional(),
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

  const parsed = createDerivativeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  const { workspaceId, sourceAssetId, derivativeAssetId, relationshipType, metadata } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const derivative = await createDerivative({
      id: newAssetId(),
      workspaceId,
      sourceAssetId,
      parentAssetId: derivativeAssetId,
      type: 'remix',
      metadata: { ...(metadata ?? {}), relationshipType },
      createdAt: now,
    });
    return NextResponse.json(derivative, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}