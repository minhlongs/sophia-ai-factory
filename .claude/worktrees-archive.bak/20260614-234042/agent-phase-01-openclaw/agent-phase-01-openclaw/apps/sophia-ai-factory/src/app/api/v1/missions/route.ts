/**
 * /api/v1/missions — Mission Engine REST API
 *
 * POST — Create a new mission (async execution)
 * GET  — List user's missions (paginated)
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/forest/missions/api-key-auth';
import { isValidCommand, getCommand } from '@/forest/missions/command-registry';
import { getBalance } from '@/land/mcu/credits-repo';
import { dispatchMission } from '@/forest/missions/dispatcher';
import { checkAiCommandQuota } from '@/seed/auth/enforce-ai-command-quota';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

export const CreateMissionSchema = z.object({
  command: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  webhook_url: z.string().url().optional(),
});

export const ListQuerySchema = z.object({
  status: z.string().optional(),
  command: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// Mission creation triggers Inngest pipeline (LLM + provider costs).
// 30/min ceiling prevents runaway loops; tier-config can lift higher.
export const POST = withRateLimit(async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateMissionApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
  );
  if (!auth.valid) {
    return apiKeyAuthErrorResponse(auth);
  }
  const userId = auth.userId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateMissionSchema.safeParse(body);
  if (!parsed.success) {
    // R2-7: Log full Zod issues server-side; never expose internal field names to callers.
    logger.warn('[/api/v1/missions POST] validation error', { issues: parsed.error.issues });
    return NextResponse.json({ error: 'Invalid mission parameters' }, { status: 400 });
  }

  const { command, params, webhook_url } = parsed.data;

  if (!isValidCommand(command)) {
    const { COMMANDS } = await import('@/forest/missions/command-registry');
    // R2-8: Filter out any commands with status 'internal' to avoid leaking private endpoints.
    const publicCommands = Object.entries(COMMANDS)
      .filter(([, def]) => (def.status as string) !== 'internal')
      .map(([name]) => name);
    return NextResponse.json({
      error: `Unknown command: ${command}`,
      available_commands: publicCommands,
    }, { status: 400 });
  }

  const commandDef = getCommand(command)!;

  // Tier monthly AI command quota check (P30 tier-gate completeness)
  const quota = await checkAiCommandQuota(userId);
  if (!quota.allowed) {
    return NextResponse.json({
      error: quota.reason ?? 'AI command quota exceeded',
      used: quota.used,
      limit: quota.limit,
      resets_at: quota.resetsAt,
      upgrade_url: 'https://sophia.agencyos.network/pricing',
    }, { status: 429 });
  }

  // Credit check — fast-path rejection only.
  // R2-6: This check is NOT atomic; concurrent requests can both pass here.
  // The authoritative atomic deduction happens in dispatcher.ts BEFORE handler execution.
  if (commandDef.credits > 0) {
    const balance = await getBalance(userId);
    if (balance.credits_remaining < commandDef.credits) {
      return NextResponse.json({
        error: 'Insufficient MCU credits',
        required: commandDef.credits,
        available: balance.credits_remaining,
        upgrade_url: 'https://sophia.agencyos.network/dashboard/credits',
      }, { status: 402 });
    }
  }

  // Insert mission row
  const db = createServerClient();
  const missionId = crypto.randomUUID();

  try {
    await db.from('engine_missions').insert({
      id: missionId,
      user_id: userId,
      command,
      params: JSON.stringify(params),
      status: 'pending',
      webhook_url: webhook_url ?? null,
    });
  } catch (err) {
    logger.error('[/api/v1/missions POST] insert error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }

  // Fire-and-forget dispatch
  // In Cloudflare Workers, use waitUntil from executionCtx
  // In Node.js (dev/test), use Promise void
  void dispatchMission(missionId).catch(err => {
    logger.error('[/api/v1/missions POST] dispatch error', err instanceof Error ? err : new Error(String(err)));
  });

  return NextResponse.json({
    id: missionId,
    status: 'pending',
    command,
    credits_required: commandDef.credits,
    eta_seconds: 60,
    stream_url: `/api/v1/missions/${missionId}/stream`,
  }, { status: 202 });
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } });

export const GET = withRateLimit(async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateMissionApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
  );
  if (!auth.valid) {
    return apiKeyAuthErrorResponse(auth);
  }
  const userId = auth.userId!;

  const { searchParams } = new URL(request.url);
  const queryParsed = ListQuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    command: searchParams.get('command') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  });

  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Invalid query params' }, { status: 400 });
  }

  const { status, command, limit, cursor } = queryParsed.data;
  const db = createServerClient();

  let query = db
    .from('engine_missions')
    .select('id, command, status, credits_used, created_at, completed_at, webhook_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq('status', status);
  if (command) query = query.eq('command', command);
  if (cursor) query = query.lt('created_at', Number(cursor));

  const { data } = await query as { data: Array<Record<string, unknown>> | null; error: unknown };
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const nextCursor = hasMore && rows.length > 0 ? String(rows[rows.length - 1].created_at) : null;

  return NextResponse.json({
    missions: rows,
    has_more: hasMore,
    next_cursor: nextCursor,
  });
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });
