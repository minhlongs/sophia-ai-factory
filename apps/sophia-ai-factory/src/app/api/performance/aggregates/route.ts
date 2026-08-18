/**
 * GET /api/performance/aggregates — Workspace performance aggregates
 *
 * Returns: per-channel avg metrics + event counts (from performance_events)
 * Phase 4: Creative Learning Loop
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = createServerClient();
    const windowStart = Date.now() - 24 * 60 * 60 * 1000; // 24h

    // Per-channel aggregates
    const channelRows = await db
      .prepare(
        `SELECT channel, event_type, COUNT(*) as count, AVG(value_cents) as avg_value_cents
         FROM performance_events
         WHERE workspace_id = ? AND recorded_at >= ?
         GROUP BY channel, event_type`,
      )
      .bind(workspaceId, windowStart)
      .all<{ channel: string; event_type: string; count: number; avg_value_cents: number | null }>();

    const channelMap = new Map<string, { count: number; avgValueCents: number; eventTypes: string[] }>();
    for (const row of channelRows.results ?? []) {
      const existing = channelMap.get(row.channel) ?? { count: 0, avgValueCents: 0, eventTypes: [] };
      existing.count += row.count;
      existing.avgValueCents += row.avg_value_cents ?? 0;
      existing.eventTypes.push(row.event_type);
      channelMap.set(row.channel, existing);
    }

    const aggregates = Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      eventCount: data.count,
      avgValueCents: Math.round(data.avgValueCents / data.eventTypes.length),
      eventTypes: data.eventTypes,
    }));

    // Total event count
    const totalRows = await db
      .prepare(`SELECT COUNT(*) as total FROM performance_events WHERE workspace_id = ? AND recorded_at >= ?`)
      .bind(workspaceId, windowStart)
      .all<{ total: number }>();
    const total = totalRows.results?.[0]?.total ?? 0;

    return NextResponse.json({
      workspaceId,
      windowHours: 24,
      totalEvents: total,
      channels: aggregates,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}