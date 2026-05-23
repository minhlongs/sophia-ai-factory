/**
 * GET  /api/raas/missions/[id] — fetch single mission
 * PATCH /api/raas/missions/[id] — update mission (title, params, priority)
 *
 * Auth: Supabase session. Users can only access own org's missions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const UpdateMissionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  description: z.string().max(500).nullable().optional(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = await resolveOrgId(user.id);
    if (!orgId) {
      return NextResponse.json({ error: 'org_not_found' }, { status: 422 });
    }
    const db = createServerClient();

    const { data: mission, error } = await db
      .from('missions')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({ mission });
  } catch (err) {
    logger.error('[GET /api/raas/missions/:id] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = await resolveOrgId(user.id);
    if (!orgId) {
      return NextResponse.json({ error: 'org_not_found' }, { status: 422 });
    }
    const db = createServerClient();

    const body = await request.json();
    const parsed = UpdateMissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { data: mission, error } = await db
      .from('missions')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !mission) {
      return NextResponse.json({ error: 'Mission not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ mission });
  } catch (err) {
    logger.error('[PATCH /api/raas/missions/:id] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
