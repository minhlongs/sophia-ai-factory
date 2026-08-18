/**
 * POST /api/ip-graph — create IP entity
 * GET /api/ip-graph?workspaceId=X&type=Y — list IP entities
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { createIP, listIP, newIpId } from '@/tree/ip-graph';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
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

  const { workspaceId, type, name, description, metadata, parentId } = body;
  if (!workspaceId || !type || !name) {
    return NextResponse.json(
      { error: 'workspaceId, type, and name are required' },
      { status: 400 },
    );
  }

  const validTypes = ['universe', 'world', 'series', 'character', 'theme', 'brand'];
  if (!validTypes.includes(type as string)) {
    return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId as string, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const id = newIpId();
    const now = Math.floor(Date.now() / 1000);
    const ip = await createIP({
      id,
      workspaceId: workspaceId as string,
      type: type as 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand',
      name: name as string,
      description: (description as string | undefined) ?? '',
      metadata: (metadata as Record<string, unknown>) ?? {},
      parentId: (parentId as string | undefined) ?? undefined,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(ip, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create IP entity';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const type = searchParams.get('type') as 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand' | null;

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const entities = await listIP(workspaceId, type ?? undefined);
    return NextResponse.json({ entities });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list IP entities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}