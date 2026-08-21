/**
 * GET /api/content-graph/performance?workspaceId=X&projectId=Y — content performance
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getContentPerformance } from '@/tree/content-graph/types';
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
    const performance = await getContentPerformance(projectId);
    return NextResponse.json({ performance });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}