/**
 * GET  /api/creative-memory/strategy-feedback?workspaceId=X — fetch strategy feedback recommendations
 * POST /api/creative-memory/strategy-feedback — mark recommendation applied or manually record strategy feedback
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  GetFeedbackSchema,
  PostFeedbackSchema,
  queryStrategyFeedback,
  upsertStrategyFeedback,
} from './strategy-feedback-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = GetFeedbackSchema.safeParse({
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    applied: searchParams.get('applied') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, applied, limit } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const recommendations = await queryStrategyFeedback(workspaceId, applied, limit);
    return NextResponse.json({ recommendations, count: recommendations.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
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

  const parsed = PostFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  if (!(await verifyWorkspaceRole(parsed.data.workspaceId, user.id, 'OPERATOR'))) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Insufficient workspace role' },
      { status: 403 },
    );
  }

  try {
    return await upsertStrategyFeedback(parsed.data);
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
