/**
 * /api/v1/missions/[id] — Get single mission state
 *
 * GET — Returns full mission including result/error
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/forest/missions/api-key-auth';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

interface MissionRow {
  id: string;
  user_id: string;
  command: string;
  params: string | null;
  status: string;
  result: string | null;
  error: string | null;
  credits_used: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  webhook_url: string | null;
  webhook_fired_at: number | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return withRateLimit(async (r: NextRequest) => {
    const auth = await validateMissionApiKey(
      r.headers.get('authorization'),
      r.headers.get('x-api-key'),
    );
    if (!auth.valid) {
      return apiKeyAuthErrorResponse(auth);
    }
    const userId = auth.userId!;

    const db = createServerClient();

    const { data } = await db
      .from('engine_missions')
      .select('id, user_id, command, params, status, result, error, credits_used, created_at, updated_at, completed_at, webhook_url, webhook_fired_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single() as { data: MissionRow | null; error: unknown };

    if (!data) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      command: data.command,
      params: data.params ? JSON.parse(data.params) : null,
      status: data.status,
      result: data.result ? JSON.parse(data.result) : null,
      error: data.error,
      credits_used: data.credits_used,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
      webhook_url: data.webhook_url,
      webhook_fired_at: data.webhook_fired_at,
    });
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(request);
}
