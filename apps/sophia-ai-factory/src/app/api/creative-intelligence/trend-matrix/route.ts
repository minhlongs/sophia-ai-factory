/**
 * GET  /api/creative-intelligence/trend-matrix?workspaceId=X — fetch detected trends & momentum matrix
 * POST /api/creative-intelligence/trend-matrix — run trend detection or record trend observation
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { detectTrends } from '@/tree/trend-intelligence';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const GetTrendMatrixSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  channel: z.string().optional(),
  topic: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const PostTrendMatrixSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  triggerDetection: z.boolean().optional().default(false),
  topic: z.string().optional(),
  channel: z.string().optional(),
  momentum: z.number().optional().default(0),
  forecast: z.record(z.string(), z.unknown()).optional().default({}),
  evidenceIds: z.array(z.string()).optional().default([]),
});

interface TrendRow {
  id: string;
  workspace_id: string;
  topic: string;
  channel: string | null;
  momentum: number;
  forecast: string | null;
  evidence_ids: string | null;
  detected_at: number;
}

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
    const d1 = createServerClient();
    let sql = 'SELECT * FROM trend_detections WHERE workspace_id = ?';
    const params: (string | number)[] = [workspaceId];
    if (channel) { sql += ' AND channel = ?'; params.push(channel); }
    if (topic) { sql += ' AND topic = ?'; params.push(topic); }
    sql += ' ORDER BY momentum DESC, detected_at DESC LIMIT ?';
    params.push(limit);

    const result = await d1.prepare(sql).bind(...params).all<TrendRow>();
    const trends = (result.results ?? []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      topic: row.topic,
      channel: row.channel,
      momentum: row.momentum,
      forecast: (() => { try { return row.forecast ? JSON.parse(row.forecast) : null; } catch { return null; } })(),
      evidenceIds: (() => { try { return row.evidence_ids ? JSON.parse(row.evidence_ids) : []; } catch { return []; } })(),
      detectedAt: row.detected_at,
    }));

    return NextResponse.json({ trends, count: trends.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch {
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

    const d1 = createServerClient();
    const now = Date.now();
    const id = `trd_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    await d1
      .prepare(
        `INSERT INTO trend_detections (id, workspace_id, topic, channel, momentum, forecast, evidence_ids, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, workspaceId, topic, channel ?? null, momentum, JSON.stringify(forecast), JSON.stringify(evidenceIds), now)
      .run();

    return NextResponse.json(
      { id, workspaceId, topic, channel: channel ?? null, momentum, forecast, evidenceIds, detectedAt: now },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
