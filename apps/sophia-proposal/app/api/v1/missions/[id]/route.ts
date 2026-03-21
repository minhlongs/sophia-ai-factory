/**
 * External RaaS API — /api/v1/missions/:id
 *
 * GET — Fetch single mission status + result (auth via API key)
 *
 * Auth: Authorization: Bearer sk_live_xxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/raas/api-key-manager';
import { checkRateLimit, rateLimitHeaders } from '@/lib/raas/rate-limiter';
import { recordUsage } from '@/lib/raas/usage-meter';
import { createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const ENDPOINT = '/api/v1/missions/:id';

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

  // Rate limit check
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
      .select('id, title, command, status, params, mcu_cost, result, error_message, plan, execution_log, started_at, completed_at, created_at, updated_at')
      .eq('id', id)
      .eq('org_id', auth.orgId)
      .single();

    if (error || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    await recordUsage({
      apiKeyId: auth.keyId, orgId: auth.orgId,
      endpoint: ENDPOINT, method: 'GET',
      statusCode: 200, mcuConsumed: 0,
      responseTimeMs: Date.now() - start,
    });

    return NextResponse.json({ mission }, {
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    console.error(`GET /api/v1/missions/${id} error:`, err);
    return NextResponse.json({ error: 'Failed to fetch mission' }, { status: 500 });
  }
}
