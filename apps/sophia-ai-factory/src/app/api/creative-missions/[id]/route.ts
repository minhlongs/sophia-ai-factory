/**
 * /api/creative-missions/[id] — Single Creative Mission REST API
 *
 * GET    — Get single mission with goals
 * PATCH  — Update mission status
 *
 * Auth: session-based via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getMission, updateMissionStatus } from '@/land/creative-mission';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const updateStatusSchema = z.object({
  status: z.enum([
    'draft',
    'planned',
    'approval_required',
    'running',
    'paused',
    'review',
    'completed',
    'learning',
    'iterating',
  ]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getMission({ missionId: params.id });

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      }
      if (result.error.code === 'FORBIDDEN') {
        return NextResponse.json({ error: result.error.message }, { status: 403 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ mission: result.value.mission });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const result = await updateMissionStatus({
      missionId: params.id,
      status: parsed.data.status,
    });

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      }
      if (result.error.code === 'FORBIDDEN') {
        return NextResponse.json({ error: result.error.message }, { status: 403 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ missionId: result.value.missionId, status: parsed.data.status });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}