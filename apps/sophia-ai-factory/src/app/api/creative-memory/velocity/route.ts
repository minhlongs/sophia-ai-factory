/**
 * GET  /api/creative-memory/velocity?workspaceId=X — fetch learning velocity metrics
 * POST /api/creative-memory/velocity — record/update learning velocity entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const GetVelocitySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  entityType: z.string().optional(),
  channel: z.string().optional(),
});

const PostVelocitySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  entityType: z.string().min(1, 'entityType is required'),
  channel: z.string().min(1, 'channel is required'),
  velocityScore: z.number().min(0).max(100),
  eventCount: z.number().int().nonnegative().optional().default(0),
  windowStartMs: z.number().int().positive().optional(),
  windowEndMs: z.number().int().positive().optional(),
  avgMetrics: z.record(z.string(), z.unknown()).optional().default({}),
});

interface VelocityRow {
  id: string;
  workspace_id: string;
  entity_type: string;
  channel: string;
  velocity_score: number;
  event_count: number;
  window_start_ms: number;
  window_end_ms: number;
  avg_metrics: string;
  created_at: number;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    entityType: searchParams.get('entityType') ?? undefined,
    channel: searchParams.get('channel') ?? undefined,
  };

  const parsed = GetVelocitySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, entityType, channel } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    let sql = 'SELECT * FROM learning_velocity WHERE workspace_id = ?';
    const params: (string | number)[] = [workspaceId];

    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (channel) {
      sql += ' AND channel = ?';
      params.push(channel);
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const result = await d1.prepare(sql).bind(...params).all<VelocityRow>();
    const records = (result.results ?? []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      entityType: row.entity_type,
      channel: row.channel,
      velocityScore: row.velocity_score,
      eventCount: row.event_count,
      windowStartMs: row.window_start_ms,
      windowEndMs: row.window_end_ms,
      avgMetrics: (() => {
        try {
          return typeof row.avg_metrics === 'string' ? JSON.parse(row.avg_metrics) : (row.avg_metrics ?? {});
        } catch {
          return {};
        }
      })(),
      createdAt: row.created_at,
    }));

    return NextResponse.json({ velocity: records, count: records.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

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

  const parsed = PostVelocitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const {
    workspaceId,
    entityType,
    channel,
    velocityScore,
    eventCount,
    windowStartMs,
    windowEndMs,
    avgMetrics,
  } = parsed.data;

  // Mutation requires OPERATOR or higher role
  const hasOperatorRole = await verifyWorkspaceRole(workspaceId, user.id, 'OPERATOR');
  if (!hasOperatorRole) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    const now = Date.now();
    const id = `vel_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const startMs = windowStartMs ?? (now - 7 * 86400000);
    const endMs = windowEndMs ?? now;

    await d1
      .prepare(
        `INSERT INTO learning_velocity (
          id, workspace_id, entity_type, channel,
          velocity_score, event_count, window_start_ms, window_end_ms,
          avg_metrics, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        workspaceId,
        entityType,
        channel,
        velocityScore,
        eventCount,
        startMs,
        endMs,
        JSON.stringify(avgMetrics),
        now
      )
      .run();

    return NextResponse.json(
      {
        id,
        workspaceId,
        entityType,
        channel,
        velocityScore,
        eventCount,
        windowStartMs: startMs,
        windowEndMs: endMs,
        avgMetrics,
        createdAt: now,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
