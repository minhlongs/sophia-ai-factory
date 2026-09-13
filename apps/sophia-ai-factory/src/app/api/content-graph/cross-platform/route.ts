/**
 * GET  /api/content-graph/cross-platform?workspaceId=X — fetch cross-platform distribution & performance
 * POST /api/content-graph/cross-platform — register distribution mapping or scheduled post
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const GetCrossPlatformSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  projectId: z.string().optional(),
  channel: z.string().optional(),
});

const PostCrossPlatformSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  planId: z.string().min(1, 'planId is required'),
  assetId: z.string().min(1, 'assetId is required'),
  channel: z.string().min(1, 'channel is required'),
  platformPostId: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'posting', 'posted', 'failed']).optional().default('scheduled'),
  scheduledAt: z.number().int().positive().optional(),
  analytics: z.record(z.string(), z.unknown()).optional().default({}),
});

interface DistAssetRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  asset_id: string;
  channel: string;
  platform_post_id: string | null;
  status: string;
  scheduled_at: number;
  posted_at: number | null;
  analytics: string;
  error: string | null;
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
    projectId: searchParams.get('projectId') ?? undefined,
    channel: searchParams.get('channel') ?? undefined,
  };

  const parsed = GetCrossPlatformSchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, channel } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    let sql = 'SELECT * FROM distribution_assets WHERE workspace_id = ?';
    const params: string[] = [workspaceId];

    if (channel) {
      sql += ' AND channel = ?';
      params.push(channel);
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const result = await d1.prepare(sql).bind(...params).all<DistAssetRow>();
    const distributions = (result.results ?? []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      planId: row.plan_id,
      assetId: row.asset_id,
      channel: row.channel,
      platformPostId: row.platform_post_id,
      status: row.status,
      scheduledAt: row.scheduled_at,
      postedAt: row.posted_at,
      analytics: (() => {
        try {
          return typeof row.analytics === 'string' ? JSON.parse(row.analytics) : (row.analytics ?? {});
        } catch {
          return {};
        }
      })(),
      error: row.error,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ distributions, count: distributions.length });
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

  const parsed = PostCrossPlatformSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const {
    workspaceId,
    planId,
    assetId,
    channel,
    platformPostId,
    status,
    scheduledAt,
    analytics,
  } = parsed.data;

  const hasOperator = await verifyWorkspaceRole(workspaceId, user.id, 'OPERATOR');
  if (!hasOperator) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    const now = Math.floor(Date.now() / 1000);
    const id = `dast_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const scheduleTime = scheduledAt ?? now;

    await d1
      .prepare(
        `INSERT INTO distribution_assets (
          id, workspace_id, plan_id, asset_id,
          channel, platform_post_id, status, scheduled_at,
          analytics, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        workspaceId,
        planId,
        assetId,
        channel,
        platformPostId ?? null,
        status,
        scheduleTime,
        JSON.stringify(analytics),
        now
      )
      .run();

    return NextResponse.json(
      {
        id,
        workspaceId,
        planId,
        assetId,
        channel,
        platformPostId: platformPostId ?? null,
        status,
        scheduledAt: scheduleTime,
        analytics,
        createdAt: now,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
