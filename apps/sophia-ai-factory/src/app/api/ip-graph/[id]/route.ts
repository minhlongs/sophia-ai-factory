/**
 * GET /api/ip-graph/[id] — get single IP entity
 * PATCH /api/ip-graph/[id] — update IP entity status
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import {
  getIP,
  updateIPStatus,
} from '@/tree/ip-graph';
import type { IP } from '@/seed/types/creative-domain';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ip = await getIP(params.id);
    if (!ip) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(ip.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ entity: ip });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch IP entity' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
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

  try {
    const existing = await getIP(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(existing.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only status can be updated via this endpoint
    if (body.status && typeof body.status === 'string') {
      const updated = await updateIPStatus(params.id, body.status as IP['status']);
      return NextResponse.json({ entity: updated });
    }

    return NextResponse.json({ error: 'Only status updates supported here' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update IP entity' }, { status: 500 });
  }
}