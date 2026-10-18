/**
 * GET  /api/creative-intelligence/trend-matrix?workspaceId=X — fetch detected trends & momentum matrix
 * POST /api/creative-intelligence/trend-matrix — run trend detection or record trend observation
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { detectTrends } from '@/tree/trend-intelligence';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  GetTrendMatrixSchema,
  PostTrendMatrixSchema,
  queryTrendDetections,
  insertTrendDetection,
} from './trend-matrix-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = GetTrendMatrixSchema.safeParse({
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    channel: searchParams.get('channel') ?? undefined,
    topic: searchParams.get('topic') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, channel, topic, limit } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const trends = await queryTrendDetections(workspaceId, channel, topic, limit);
    return NextResponse.json({ trends, count: trends.length });
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

  const parsed = PostTrendMatrixSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, triggerDetection, topic, channel, momentum, forecast, evidenceIds } = parsed.data;
  if (!(await verifyWorkspaceRole(workspaceId, user.id, 'OPERATOR'))) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    if (triggerDetection) {
      const detectResult = await detectTrends({ workspaceId });
      if (!detectResult.ok) return NextResponse.json({ error: detectResult.error.message }, { status: 500 });
      return NextResponse.json({ trends: detectResult.value, count: detectResult.value.length }, { status: 201 });
    }

    if (!topic) return NextResponse.json({ error: 'topic is required when not triggering detection' }, { status: 400 });

    const created = await insertTrendDetection({
      workspaceId,
      topic,
      channel,
      momentum,
      forecast,
      evidenceIds,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
