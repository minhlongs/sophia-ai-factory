/**
 * GET /api/content-graph/lineage?workspaceId=X&projectId=Y — content lineage
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getContentLineage } from '@/tree/content-graph';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
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
    const lineage = await getContentLineage(projectId);
    if (!lineage) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(lineage);
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}