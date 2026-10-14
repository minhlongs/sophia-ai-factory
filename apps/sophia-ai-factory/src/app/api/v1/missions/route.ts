/**
 * /api/v1/missions — Mission Engine REST API
 *
 * POST — Create a new mission (async execution)
 * GET  — List user's missions (paginated)
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/tree/missions/api-key-auth';
import { isValidCommand, getCommand } from '@/tree/missions/command-registry';
import { getBalance } from '@/tree/mcu/credits-repo';
import { dispatchMission } from '@/forest/missions/dispatcher';
import { checkAiCommandQuota } from '@/seed/auth/enforce-ai-command-quota';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import {
  CreateMissionSchema,
  ListQuerySchema,
  listUserMissionsPaginated,
} from './missions-v1-helpers';

export const dynamic = 'force-dynamic';
export { CreateMissionSchema, ListQuerySchema };

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
    logger.warn('[/api/v1/missions POST] validation error', { issues: parsed.error.issues });
    return NextResponse.json({ error: 'Invalid mission parameters' }, { status: 400 });
  }

  const { command, params, webhook_url } = parsed.data;

  if (!isValidCommand(command)) {
    const { COMMANDS } = await import('@/tree/missions/command-registry');
    const publicCommands = Object.entries(COMMANDS)
      .filter(([, def]) => (def.status as string) !== 'internal')
      .map(([name]) => name);
    return NextResponse.json({
      error: `Unknown command: ${command}`,
      available_commands: publicCommands,
    }, { status: 400 });
  }

  const commandDef = getCommand(command)!;

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

  void dispatchMission(missionId).catch((err) => {
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
  return listUserMissionsPaginated(auth.userId!, new URL(request.url).searchParams);
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });
