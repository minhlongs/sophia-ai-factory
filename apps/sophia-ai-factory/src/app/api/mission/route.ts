/**
 * POST /api/mission — create mission
 * GET  /api/mission?workspaceId=X&status=Y&limit=Z&offset=W — list missions
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { createMission, listMissions, newMissionId } from '@/tree/mission';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

const CreateMissionSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'planned', 'approval_required', 'running', 'paused', 'review', 'completed', 'learning', 'iterating']).optional(),
  priority: z.number().int().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ListMissionsSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  status: z
    .enum(['draft', 'planned', 'approval_required', 'running', 'paused', 'review', 'completed', 'learning', 'iterating'])
    .optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const dynamic = 'force-dynamic';

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

  const parsed = CreateMissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const mission = await createMission({
      id: newMissionId(),
      workspaceId: parsed.data.workspaceId,
      creatorId: user.id,
      title: parsed.data.title,
      objective: parsed.data.description ?? '',
      audience: '',
      geography: '',
      timeframeStart: 0,
      timeframeEnd: 0,
      budgetCents: parsed.data.budgetCents ?? 0,
      spentCents: 0,
      autonomyLevel: 1,
      channels: [],
      monetizationGoals: [],
      constraints: parsed.data.metadata ?? {},
      successMetrics: {},
      status: parsed.data.status ?? 'draft',
      currentPhase: 'init',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    return NextResponse.json(mission, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = {
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  };

  const parsed = ListMissionsSchema.safeParse({
    ...raw,
    limit: raw.limit ? Number(raw.limit) : 50,
    offset: raw.offset ? Number(raw.offset) : 0,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const missions = await listMissions(parsed.data.workspaceId, parsed.data.status);
    const start = parsed.data.offset;
    const end = start + parsed.data.limit;
    const page = missions.slice(start, end);
    return NextResponse.json({ missions: page, total: missions.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}