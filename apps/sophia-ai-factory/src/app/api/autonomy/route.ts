/**
 * GET /api/autonomy — fetch current autonomy config
 * PATCH /api/autonomy — update autonomy level
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';

const PatchBodySchema = z.object({
  level: z.coerce.number().int().min(0).max(4),
});

export async function GET(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;
    const user = adminResult.user;

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const membership = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string }>();

    const workspaceId = membership?.org_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const row = await d1
      .prepare(
        'SELECT level, agent_type, overrides_json FROM autonomy_configs WHERE workspace_id = ?1 AND agent_type = \'global\'',
      )
      .bind(workspaceId)
      .first<{ level: number; agent_type: string; overrides_json: string | null }>();

    return NextResponse.json({
      level: row?.level ?? 1,
      agentType: row?.agent_type ?? 'global',
      overrides: row?.overrides_json ? JSON.parse(row.overrides_json) : {},
    });
  } catch (error) {
    logger.error('[api/autonomy] GET failed', {
      error: toError(error).message,
      details: toError(error).message,
    });
    return NextResponse.json({ error: 'Failed to fetch autonomy config', status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;
    const user = adminResult.user;

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const membership = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string }>();

    const workspaceId = membership?.org_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.level !== 'number') {
      return NextResponse.json({ error: 'Invalid body: level (0-4) required' }, { status: 400 });
    }

    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid level: ${String(body.level)}. Must be 0-4.` },
        { status: 400 },
      );
    }

    const { level } = parsed.data;
    const id = `${workspaceId}:global`;
    const overridesJson = '{}';

    await d1
      .prepare(
        'INSERT INTO autonomy_configs (id, workspace_id, agent_type, level, overrides_json, created_at, updated_at) ' +
        'VALUES (?1, ?2, \'global\', ?3, ?4, COALESCE((SELECT created_at FROM autonomy_configs WHERE id = ?1), unixepoch()), unixepoch())',
      )
      .bind(id, workspaceId, level, overridesJson)
      .run();

    return NextResponse.json({ ok: true, level, agentType: 'global' });
  } catch (error) {
    logger.error('[api/autonomy] PATCH failed', {
      error: toError(error).message,
      details: toError(error).message,
    });
    return NextResponse.json({ error: 'Failed to update autonomy config', status: 500 });
  }
}