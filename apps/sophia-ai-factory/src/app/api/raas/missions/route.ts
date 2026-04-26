/**
 * GET /api/raas/missions  — list missions for authenticated user
 * POST /api/raas/missions — create new mission
 *
 * Uses Supabase session for auth. Zod validates inputs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

export const dynamic = 'force-dynamic';

const CreateMissionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('nl'),
    prompt: z.string().min(1).max(2000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  }),
  z.object({
    mode: z.literal('template').optional(),
    title: z.string().min(1).max(200),
    command: z.string().min(1).max(100),
    params: z.record(z.unknown()).optional().default({}),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
    description: z.string().max(500).optional(),
  }),
]);

// Legacy schema without mode field (backward compat)
const LegacyMissionSchema = z.object({
  title: z.string().min(1).max(200),
  command: z.string().min(1).max(100),
  params: z.record(z.unknown()).optional().default({}),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  description: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = createServerClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1);
    const offset = (page - 1) * limit;

    const { data: missions, error, count } = await db
      .from('missions')
      .select('id, title, command, status, priority, mcu_cost, result, error_message, created_at, updated_at, completed_at', { count: 'exact' })
      .eq('org_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[GET /api/raas/missions] Supabase error', toError(error));
      return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
    }

    return NextResponse.json({
      missions: missions ?? [],
      total: count ?? 0,
      page,
      page_size: limit,
    });
  } catch (err) {
    logger.error('[GET /api/raas/missions] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = createServerClient();

    const body = await request.json() as unknown;

    // Try NL/template discriminated union first, then legacy schema
    const parsed = CreateMissionSchema.safeParse(body);
    const legacyParsed = parsed.success ? null : LegacyMissionSchema.safeParse(body);

    if (!parsed.success && !legacyParsed?.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    let title: string;
    let command: string;
    let params: Record<string, unknown>;
    let priority: string;
    let description: string | undefined;

    if (parsed.success) {
      const data = parsed.data;
      if (data.mode === 'nl') {
        // NL mode: derive title and command from prompt
        title = data.prompt.slice(0, 100);
        command = 'nl_decompose';
        params = { prompt: data.prompt };
        priority = data.priority ?? 'normal';
        description = data.prompt;
      } else {
        title = data.title;
        command = data.command;
        params = data.params ?? {};
        priority = data.priority ?? 'normal';
        description = data.description;
      }
    } else {
      const data = legacyParsed!.data!;
      title = data.title;
      command = data.command;
      params = data.params ?? {};
      priority = data.priority ?? 'normal';
      description = data.description;
    }

    const { data: mission, error } = await db
      .from('missions')
      .insert({
        org_id: user.id,
        title,
        command,
        params,
        priority,
        description: description ?? null,
        status: 'queued',
        mcu_cost: 0,
        mcu_reserved: 0,
        execution_log: [],
        max_retries: 3,
        retry_count: 0,
        is_sub_mission: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('[POST /api/raas/missions] Supabase error', toError(error));
      return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
    }

    // Fire-and-forget execute if internal secret configured
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (internalSecret && mission) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      fetch(`${baseUrl}/api/raas/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': internalSecret },
        body: JSON.stringify({ mission_id: mission.id }),
      }).catch(() => {});
    }

    return NextResponse.json({ mission, mission_id: (mission as { id: string } | null)?.id }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/raas/missions] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
