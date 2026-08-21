/**
 * POST /api/content-graph — create content project
 * GET  /api/content-graph?workspaceId=X — list content projects
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { createProject, listProjects, newProjectId } from '@/tree/content-graph';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ContentKind, ContentStatus } from '@/seed/types/creative-domain';

export const dynamic = 'force-dynamic';

const CONTENT_KINDS: ContentKind[] = ['video_short', 'video_long', 'image', 'audio', 'article', 'carousel', 'mixed'];
const CONTENT_STATUSES: ContentStatus[] = ['draft', 'planned', 'in_production', 'review', 'approved', 'published', 'archived'];

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  format: z.enum(CONTENT_KINDS as [string, ...string[]]).optional(),
  status: z.enum(CONTENT_STATUSES as [string, ...string[]]).optional(),
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

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  const { workspaceId, title, description, format, status, metadata } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const project = await createProject({
      id: newProjectId(),
      workspaceId,
      creatorId: user.id,
      title,
      description: description ?? '',
      format: (format as ContentKind) ?? 'video_short',
      status: (status as ContentStatus) ?? 'draft',
      budgetCents: 0,
      actualCostCents: 0,
      metadata: metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = new URL(request.url).searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const projects = await listProjects(workspaceId);
    return NextResponse.json({ projects });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}