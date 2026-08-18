/**
 * /api/creative-missions — Creative Mission REST API
 *
 * POST — Create a new creative mission
 * GET  — List user's missions (paginated)
 *
 * Auth: session-based via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createMission, listMissions } from '@/land/creative-mission';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const createMissionSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  title: z.string().min(1, 'Title is required'),
  objective: z.string().min(1, 'Objective is required'),
  audience: z.string().min(1, 'Audience is required'),
  geography: z.string().default(''),
  timeframeStart: z.number().int().positive(),
  timeframeEnd: z.number().int().positive(),
  budgetCents: z.number().int().nonnegative().default(0),
  autonomyLevel: z.number().min(0).max(4).default(1),
  channels: z.array(z.string()).default([]),
  monetizationGoals: z.array(z.string()).default([]),
  constraints: z.record(z.string(), z.unknown()).default({}),
  successMetrics: z.record(z.string(), z.number()).default({}),
  brandId: z.string().optional(),
});

const listQuerySchema = z.object({
  workspaceId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createMissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const result = await createMission(parsed.data);

    if (!result.ok) {
      if (result.error.code === 'NOT_AUTHENTICATED') {
        return NextResponse.json({ error: result.error.message }, { status: 401 });
      }
      if (result.error.code === 'FORBIDDEN') {
        return NextResponse.json({ error: result.error.message }, { status: 403 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(
      { missionId: result.value.missionId },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const limitRaw = searchParams.get('limit');
    const parsed = listQuerySchema.safeParse({
      workspaceId: workspaceId ?? '',
      ...(limitRaw ? { limit: Number(limitRaw) } : {}),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const result = await listMissions(parsed.data);

    if (!result.ok) {
      if (result.error.code === 'NOT_AUTHENTICATED') {
        return NextResponse.json({ error: result.error.message }, { status: 401 });
      }
      if (result.error.code === 'FORBIDDEN') {
        return NextResponse.json({ error: result.error.message }, { status: 403 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      missions: result.value.missions,
      count: result.value.count,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}