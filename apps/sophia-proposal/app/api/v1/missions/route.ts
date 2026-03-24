/**
 * External RaaS API — /api/v1/missions
 *
 * POST — Create and queue a mission (auth via API key)
 * GET  — List missions for the API key's org
 *
 * Auth: Authorization: Bearer sk_live_xxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import type { MissionTemplate, OrgBalance, Mission } from '@/lib/db/types';
import { validateApiKey } from '@/lib/raas/api-key-manager';
import { checkRateLimit, rateLimitHeaders } from '@/lib/raas/rate-limiter';
import { recordUsage } from '@/lib/raas/usage-meter';

export const dynamic = 'force-dynamic';

const ENDPOINT = '/api/v1/missions';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Check if hostname is in 172.16.0.0/12 private range. */
function isPrivate172(h: string): boolean {
  if (!h.startsWith('172.')) return false;
  const second = parseInt(h.split('.')[1], 10);
  return second >= 16 && second <= 31;
}

function extractApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const start = Date.now();
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
    const db = await getD1Client();
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const limit = Math.min(50, parseInt(params.get('limit') ?? '20', 10));

    let query = db
      .from('missions')
      .select('id, title, command, status, mcu_cost, created_at, updated_at')
      .eq('org_id', auth.orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data: missions, error } = await query;
    if (error) throw error;

    await recordUsage({
      apiKeyId: auth.keyId, orgId: auth.orgId,
      endpoint: ENDPOINT, method: 'GET',
      statusCode: 200, mcuConsumed: 0,
      responseTimeMs: Date.now() - start,
    });

    return NextResponse.json({ missions: missions ?? [] }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    console.error('GET /api/v1/missions error:', err);
    try {
      await recordUsage({
        apiKeyId: auth.keyId!, orgId: auth.orgId!,
        endpoint: ENDPOINT, method: 'GET',
        statusCode: 500, mcuConsumed: 0,
        responseTimeMs: Date.now() - start,
      });
    } catch { /* ignore usage recording failure */ }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to fetch missions', detail: msg }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const start = Date.now();
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const auth = await validateApiKey(rawKey);
  if (!auth.valid || !auth.orgId || !auth.keyId) {
    return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
  }

  if (!auth.permissions?.includes('missions:create')) {
    return NextResponse.json({ error: 'Forbidden: missing missions:create permission' }, { status: 403 });
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
    const body = await request.json();
    const { command, params, title, priority, webhook_url } = body;

    if (!command) {
      return NextResponse.json({ error: 'command is required' }, { status: 400 });
    }

    // Validate webhook URL to prevent SSRF
    if (webhook_url) {
      try {
        const u = new URL(webhook_url);
        const h = u.hostname;
        if (!['http:', 'https:'].includes(u.protocol) ||
            h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
            h.startsWith('10.') || h.startsWith('192.168.') || isPrivate172(h) ||
            h === '169.254.169.254' || h.endsWith('.internal')) {
          return NextResponse.json({ error: 'webhook_url must be a public HTTPS URL' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid webhook_url' }, { status: 400 });
      }
    }

    const db = await getD1Client();

    // Look up MCU cost (is_active stored as integer 1 in D1)
    let mcuCost = 0;
    try {
      const { data: template } = await db
        .from<MissionTemplate>('mission_templates')
        .select('mcu_cost')
        .eq('command', command)
        .eq('is_active', 1)
        .maybeSingle();
      mcuCost = template?.mcu_cost ?? 5; // default 5 MCU if template not found
    } catch {
      mcuCost = 5; // fallback
    }

    // Check balance
    const { data: balance } = await db
      .from<OrgBalance>('org_balances')
      .select('balance')
      .eq('org_id', auth.orgId)
      .maybeSingle();

    if (!balance || balance.balance < mcuCost) {
      return NextResponse.json(
        { error: 'Insufficient MCU balance', required: mcuCost, current: balance?.balance ?? 0 },
        { status: 402 }
      );
    }

    // Reserve MCU
    const { error: deductErr } = await db.rpc('debit_mcu_balance', {
      p_org_id: auth.orgId, p_amount: mcuCost, p_feature: command,
    });
    if (deductErr) return NextResponse.json({ error: 'Failed to reserve MCU' }, { status: 402 });

    // Create mission (generate ID for D1 compatibility)
    const missionId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const { error: insertErr } = await db
      .from('missions')
      .insert({
        id: missionId,
        org_id: auth.orgId,
        title: (title ?? command).trim(),
        command,
        params: params ?? {},
        priority: priority ?? 'normal',
        status: 'queued',
        mcu_cost: mcuCost,
        mcu_reserved: mcuCost,
        webhook_url: webhook_url ?? null,
      });

    if (insertErr) {
      await db.rpc('credit_mcu_balance', {
        p_org_id: auth.orgId, p_amount: mcuCost, p_subscription_id: 'mission:refund:v1',
      });
      throw new Error(insertErr.message ?? 'Mission insert failed');
    }

    // Trigger async PEV execution
    const executeUrl = new URL('/api/raas/execute', request.url).toString();
    fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ mission_id: missionId }),
    }).catch((e) => console.error('[v1/missions] execute trigger failed:', e));

    await recordUsage({
      apiKeyId: auth.keyId, orgId: auth.orgId,
      endpoint: ENDPOINT, method: 'POST',
      statusCode: 201, mcuConsumed: mcuCost,
      responseTimeMs: Date.now() - start,
    });

    return NextResponse.json(
      { mission_id: missionId, status: 'queued', mcu_cost: mcuCost },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/v1/missions error:', err);
    try {
      await recordUsage({
        apiKeyId: auth.keyId!, orgId: auth.orgId!,
        endpoint: ENDPOINT, method: 'POST',
        statusCode: 500, mcuConsumed: 0,
        responseTimeMs: Date.now() - start,
      });
    } catch { /* ignore usage recording failure */ }
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: 'Mission creation error v3', detail: msg }, { status: 500 });
  }
}
