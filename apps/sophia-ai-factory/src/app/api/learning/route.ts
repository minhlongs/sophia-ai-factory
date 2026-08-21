/**
 * POST /api/learning — run learning loop
 * GET  /api/learning?workspaceId=X&limit=Y — get latest insights
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { runLearningLoop, getLatestInsights } from '@/tree/learning';
import type { CreativeMemory } from '@/seed/types/creative-domain';
import { getErrorMessage } from '@/seed/utils/to-error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PostBodySchema = z.object({
  workspaceId: z.string().min(1),
  missionId: z.string().min(1).optional(),
  lookbackDays: z.coerce.number().int().min(1).max(90).default(30),
  generateRecommendations: z.coerce.boolean().default(true),
});

const VALID_CATEGORIES = [
  'performance',
  'audience',
  'creative',
  'budget',
  'timing',
  'operational',
  'provenance',
] as const;

const QuerySchema = z.object({
  workspaceId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(VALID_CATEGORIES).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── POST /api/learning ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { workspaceId, missionId } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // missionId is optional but runLearningLoop requires a valid one;
  // default to workspaceId if caller omits it
  const effectiveMissionId = missionId ?? workspaceId;

  const result = await runLearningLoop(workspaceId, effectiveMissionId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(result.value, { status: 200 });
}

// ─── GET /api/learning ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    category: searchParams.get('category') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { workspaceId, limit, category } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const insights = await getLatestInsights(workspaceId, category as CreativeMemory['category'] | undefined);
    // Apply limit client-side since getLatestInsights doesn't accept one
    const limited = insights.slice(0, limit);
    return NextResponse.json({ insights: limited }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
