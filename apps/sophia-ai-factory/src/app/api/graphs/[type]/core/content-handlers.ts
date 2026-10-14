import { NextRequest, NextResponse } from 'next/server';
import { getContentLineage, getContentPerformance, listProjects } from '@/tree/content-graph';
import { parseAndAuthorize } from './auth-gate';
import {
  type AuthGate,
  contentLineageParamsSchema,
  listProjectsParamsSchema,
} from './types';

export async function loadAuthorizedContentLineage(
  request: NextRequest,
  userId: string,
): Promise<AuthGate<NonNullable<Awaited<ReturnType<typeof getContentLineage>>>>> {
  const auth = await parseAndAuthorize(request, userId, contentLineageParamsSchema);
  if (!auth.ok) {
    return auth;
  }

  const lineage = await getContentLineage(auth.data.projectId);
  if (!lineage) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Content project not found' }, { status: 404 }),
    };
  }

  if (lineage.project.workspaceId !== auth.data.workspaceId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Project does not belong to this workspace' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, data: lineage };
}

export async function handleContentLineage(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const lineage = await loadAuthorizedContentLineage(request, userId);
  if (!lineage.ok) {
    return lineage.response;
  }

  return NextResponse.json({ ok: true, data: lineage.data });
}

export async function handleContentPerformance(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const lineage = await loadAuthorizedContentLineage(request, userId);
  if (!lineage.ok) {
    return lineage.response;
  }

  const performance = await getContentPerformance(lineage.data.project.id);

  return NextResponse.json({ ok: true, data: { performance } });
}

export async function handleProjects(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const auth = await parseAndAuthorize(request, userId, listProjectsParamsSchema);
  if (!auth.ok) {
    return auth.response;
  }

  const projects = await listProjects(auth.data.workspaceId, auth.data.missionId);

  return NextResponse.json({
    ok: true,
    data: { projects, count: projects.length },
  });
}
