/**
 * POST /api/performance/events — Record performance event
 *
 * Phase 4: Creative Learning Loop
 *
 * Auth: session-based via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { recordPerformanceEvent, newPerformanceEventId } from '@/tree/performance';
import type { PerformanceEvent } from '@/seed/types/creative-domain';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

const eventSchema = z.object({
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
  projectId: z.string().optional(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  eventType: z.string().min(1),
  count: z.number().int().positive().default(1),
  valueCents: z.number().int().nonnegative().default(0),
  channel: z.string().optional(),
  rawData: z.record(z.string(), z.unknown()).optional(),
  recordedAt: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const event: PerformanceEvent = {
      id: newPerformanceEventId(),
      workspaceId: parsed.data.workspaceId,
      assetId: parsed.data.assetId,
      projectId: parsed.data.projectId ?? '',
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      eventType: parsed.data.eventType,
      count: parsed.data.count,
      valueCents: parsed.data.valueCents,
      channel: parsed.data.channel ?? 'unknown',
      rawData: parsed.data.rawData ?? {},
      recordedAt: parsed.data.recordedAt ?? Date.now(),
    };

    const hasAccess = await verifyWorkspaceAccess(event.workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await recordPerformanceEvent(event);

    return NextResponse.json({ id: event.id, status: 'recorded' }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}