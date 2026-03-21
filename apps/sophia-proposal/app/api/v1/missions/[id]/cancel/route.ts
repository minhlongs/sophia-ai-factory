/**
 * External RaaS API — POST /api/v1/missions/:id/cancel
 *
 * Cancel a queued mission and refund reserved MCU.
 * Only queued/planning missions can be cancelled.
 *
 * Auth: Authorization: Bearer sk_live_xxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/raas/api-key-manager';
import { checkRateLimit, rateLimitHeaders } from '@/lib/raas/rate-limiter';
import { recordUsage } from '@/lib/raas/usage-meter';
import { createServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const ENDPOINT = '/api/v1/missions/:id/cancel';
const CANCELLABLE_STATUSES = ['queued', 'planning'];

function extractApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(
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

    // Fetch mission (verify ownership)
    const { data: mission, error: fetchErr } = await db
      .from('missions')
      .select('id, status, mcu_reserved, org_id')
      .eq('id', id)
      .eq('org_id', auth.orgId)
      .single();

    if (fetchErr || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (!CANCELLABLE_STATUSES.includes(mission.status)) {
      return NextResponse.json(
        { error: `Cannot cancel mission in '${mission.status}' status. Only queued/planning missions can be cancelled.` },
        { status: 409 }
      );
    }

    // Atomic cancel: only update if still in cancellable status (prevents double-refund race)
    const { data: updated, error: updateErr } = await db
      .from('missions')
      .update({
        status: 'failed',
        error_message: 'Cancelled by API consumer',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .in('status', CANCELLABLE_STATUSES)
      .select('id')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: 'Mission already cancelled or no longer cancellable' },
        { status: 409 }
      );
    }

    // Refund MCU (safe — only reached if atomic update succeeded)
    if (mission.mcu_reserved > 0) {
      await db.rpc('credit_mcu_balance', {
        p_org_id: auth.orgId,
        p_amount: mission.mcu_reserved,
        p_subscription_id: `mission:cancel:${id}`,
      });
    }

    await recordUsage({
      apiKeyId: auth.keyId, orgId: auth.orgId,
      endpoint: ENDPOINT, method: 'POST',
      statusCode: 200, mcuConsumed: 0,
      responseTimeMs: Date.now() - start,
    });

    return NextResponse.json(
      { cancelled: true, mission_id: id, mcu_refunded: mission.mcu_reserved },
      { headers: rateLimitHeaders(rl) }
    );
  } catch (err) {
    console.error(`POST /api/v1/missions/${id}/cancel error:`, err);
    return NextResponse.json({ error: 'Failed to cancel mission' }, { status: 500 });
  }
}
