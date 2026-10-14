import { NextRequest, NextResponse } from 'next/server';
import { getIP, getIPChildren, getIPDerivatives, listIP } from '@/tree/ip-graph';
import { parseAndAuthorize } from './auth-gate';
import { ipLineageParamsSchema, ipListParamsSchema } from './types';

export async function handleIpLineage(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const auth = await parseAndAuthorize(request, userId, ipLineageParamsSchema);
  if (!auth.ok) {
    return auth.response;
  }

  const ip = await getIP(auth.data.ipId);
  if (!ip) {
    return NextResponse.json({ error: 'IP entity not found' }, { status: 404 });
  }

  if (ip.workspaceId !== auth.data.workspaceId) {
    return NextResponse.json({ error: 'IP entity does not belong to this workspace' }, { status: 403 });
  }

  const [children, derivatives] = await Promise.all([
    getIPChildren(auth.data.ipId),
    getIPDerivatives(auth.data.ipId),
  ]);

  return NextResponse.json({
    ok: true,
    data: { ip, children, derivatives },
  });
}

export async function handleIpList(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const auth = await parseAndAuthorize(request, userId, ipListParamsSchema);
  if (!auth.ok) {
    return auth.response;
  }

  const entities = await listIP(auth.data.workspaceId);

  return NextResponse.json({
    ok: true,
    data: { entities, count: entities.length },
  });
}
