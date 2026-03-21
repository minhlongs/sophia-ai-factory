/**
 * External RaaS API — GET /api/v1/missions/:id/result
 *
 * Returns mission result data for completed missions.
 * Lightweight endpoint focused only on the output.
 *
 * Auth: Authorization: Bearer sk_live_xxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/raas/api-key-manager';
import { checkRateLimit, rateLimitHeaders } from '@/lib/raas/rate-limiter';
import { recordUsage } from '@/lib/raas/usage-meter';
import { createServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const ENDPOINT = '/api/v1/missions/:id/result';

function extractApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const { id } = await params;

  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const auth = await validateApiKey(rawKey);
  if (!auth.valid || !auth.orgId || !auth.keyId) {
    return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
  }

  // Rate limit
  const rl = checkRateLimit(auth.keyId, auth.rateLimit ?? 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const db = createServerClient();
    const { data: mission, error } = await db
      .from('missions')
      .select('id, command, status, result, error_message, mcu_cost, completed_at')
      .eq('id', id)
      .eq('org_id', auth.orgId)
      .single();

    if (error || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (mission.status !== 'completed' && mission.status !== 'failed') {
      return NextResponse.json(
        {
          mission_id: id,
          status: mission.status,
          message: 'Mission is still in progress. Poll this endpoint until status is completed/failed.',
        },
        { status: 202, headers: { ...rateLimitHeaders(rl), 'Retry-After': '5' } }
      );
    }

    await recordUsage({
      apiKeyId: auth.keyId, orgId: auth.orgId,
      endpoint: ENDPOINT, method: 'GET',
      statusCode: 200, mcuConsumed: 0,
      responseTimeMs: Date.now() - start,
    });

    return NextResponse.json({
      mission_id: mission.id,
      command: mission.command,
      status: mission.status,
      result: mission.result,
      error_message: mission.error_message,
      mcu_cost: mission.mcu_cost,
      completed_at: mission.completed_at,
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    console.error(`GET /api/v1/missions/${id}/result error:`, err);
    return NextResponse.json({ error: 'Failed to fetch result' }, { status: 500 });
  }
}
