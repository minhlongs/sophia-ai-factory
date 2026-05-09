/**
 * GET /api/raas/missions  — list missions for authenticated user
 * POST /api/raas/missions — create new mission
 *
 * Uses Supabase session for auth. Zod validates inputs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const ModelSchema = z.object({
  providerId: z.string().min(1).max(50),
  modelId: z.string().min(1).max(100),
});

const CreateMissionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('nl'),
    prompt: z.string().min(1).max(2000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
    model: ModelSchema.optional(),
  }),
  z.object({
    mode: z.literal('template').optional(),
    title: z.string().min(1).max(200),
    command: z.string().min(1).max(100),
    params: z.record(z.string(), z.unknown()).optional().default({}),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
    description: z.string().max(500).optional(),
    model: ModelSchema.optional(),
  }),
]);

// Legacy schema without mode field (backward compat)
const LegacyMissionSchema = z.object({
  title: z.string().min(1).max(200),
  command: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  description: z.string().max(500).optional(),
  model: ModelSchema.optional(),
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
    let model: { providerId: string; modelId: string } | undefined;

    if (parsed.success) {
      const data = parsed.data;
      model = data.model;
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
      model = data.model;
      title = data.title;
      command = data.command;
      params = data.params ?? {};
      priority = data.priority ?? 'normal';
      description = data.description;
    }

    // BYOK validation: if model specified, check user has the provider configured
    // Note: user_api_keys (D1) has no revoked_at column — no filter needed
    if (model) {
      const { data: keyRows, error: byokError } = await db
        .from('user_api_keys')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('provider', model.providerId)
        .limit(1);
      if (byokError) {
        logger.error('[POST /api/raas/missions] BYOK lookup failed', { event: 'byok_lookup_failed', error: String(byokError), userId: user.id, provider: model.providerId });
        return new NextResponse(JSON.stringify({ error: 'BYOK lookup failed' }), { status: 500 });
      }
      const hasProvider = Array.isArray(keyRows) ? keyRows.length > 0 : keyRows !== null;
      if (!hasProvider) {
        return NextResponse.json(
          { error: 'Provider not configured', provider: model.providerId },
          { status: 400 },
        );
      }
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
        byok_provider_id: model?.providerId ?? null,
        byok_model_id: model?.modelId ?? null,
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
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
