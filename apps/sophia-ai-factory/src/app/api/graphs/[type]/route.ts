/**
 * GET /api/graphs/[type] — Thin read-only API for graph lineage data.
 * Validates params via Zod, delegates to tree-layer stores, returns JSON.
 * Unauthenticated → 401; Forbidden → 403; Not found → 404.
 *
 * Types supported:
 * - ip-lineage?workspaceId=X&ipId=Y
 * - content-lineage?workspaceId=X&projectId=Y
 * - projects?workspaceId=X&missionId=Z (optional)
 *
 * @module app/api/graphs/[type]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getContentLineage, getContentPerformance, listProjects } from '@/tree/content-graph';
import { getIP, getIPChildren, getIPDerivatives, listIP } from '@/tree/ip-graph';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

// ── Validation Schemas ───────────────────────────────────────────────────────

const ipLineageParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  ipId: z.string().min(1, 'IP ID is required'),
});

const contentLineageParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
});

const listProjectsParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  missionId: z.string().optional(),
});

const ipListParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

// ── Helper: Verify Workspace Access ──────────────────────────────────────────

async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

// ── Helper: Parse query params + authorize workspace in one gate ─────────────

type AuthGate<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

async function parseAndAuthorize<T extends { workspaceId: string }>(
  request: NextRequest,
  userId: string,
  schema: z.ZodType<T>,
): Promise<AuthGate<T>> {
  const sp = new URL(request.url).searchParams;
  const parsed = schema.safeParse(Object.fromEntries(sp));
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      ),
    };
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, userId);
  if (!hasAccess) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, data: parsed.data };
}

// ── Per-type handlers (each owns its own store calls) ────────────────────────

async function handleIpLineage(
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

async function loadAuthorizedContentLineage(
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

async function handleContentLineage(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const lineage = await loadAuthorizedContentLineage(request, userId);
  if (!lineage.ok) {
    return lineage.response;
  }

  return NextResponse.json({ ok: true, data: lineage.data });
}

async function handleContentPerformance(
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

async function handleProjects(
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

async function handleIpList(
  request: NextRequest,
  userId: string,
): Promise<NextResponse> {
  // Optional: list IP entities for a workspace
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

// ── GET Handler ──────────────────────────────────────────────────────────────

const GRAPH_TYPE_HANDLERS: Record<string, (request: NextRequest, userId: string) => Promise<NextResponse>> = {
  'ip-lineage': handleIpLineage,
  'content-lineage': handleContentLineage,
  'content-performance': handleContentPerformance,
  projects: handleProjects,
  'ip-list': handleIpList,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
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
