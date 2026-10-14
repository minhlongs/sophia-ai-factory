import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getErrorMessage } from '@/seed/utils/to-error';
import { handleContentLineage, handleContentPerformance, handleProjects } from './content-handlers';
import { handleIpLineage, handleIpList } from './ip-handlers';

const GRAPH_TYPE_HANDLERS: Record<string, (request: NextRequest, userId: string) => Promise<NextResponse>> = {
  'ip-lineage': handleIpLineage,
  'content-lineage': handleContentLineage,
  'content-performance': handleContentPerformance,
  projects: handleProjects,
  'ip-list': handleIpList,
};

export async function handleGraphRequest(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { type } = await params;

    const handler = GRAPH_TYPE_HANDLERS[type];
    if (!handler) {
      return NextResponse.json(
        { error: `Unknown graph type: ${type}. Supported: ${Object.keys(GRAPH_TYPE_HANDLERS).join(', ')}` },
        { status: 404 },
      );
    }

    return await handler(request, user.id);
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
