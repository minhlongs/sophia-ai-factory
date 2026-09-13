/**
 * GET /api/ip-graph/[id]/children — get children of an IP entity
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getIP, getIPChildren } from '@/tree/ip-graph';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parent = await getIP(id);
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(parent.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const children = await getIPChildren(id);
    return NextResponse.json({ children });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
  }
}