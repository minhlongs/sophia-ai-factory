/**
 * GET  /api/v1/integrations/affiliate-networks — list configured networks for tenant
 * POST /api/v1/integrations/affiliate-networks — upsert network credentials
 * @module app/api/v1/integrations/affiliate-networks/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { listNetworks, saveCredentials, AffiliateNetwork, NetworkCredentialPayload } from '@/land/affiliates/credentials';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

const VALID_NETWORKS: AffiliateNetwork[] = [
  'impact_radius','partnerstack','cj','shareasale','clickbank',
  'binance','bybit','bitget','coinbase',
];

const UpsertSchema = z.object({
  network: z.enum(['impact_radius','partnerstack','cj','shareasale','clickbank','binance','bybit','bitget','coinbase']),
  payload: z.record(z.string(), z.string()),
});

export const GET = withRateLimit(async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const rows = await listNetworks(db, user.id);
    const configured = new Set(rows.map(r => r.network));
    const all = VALID_NETWORKS.map(n => {
      const row = rows.find(r => r.network === n);
      return {
        network: n,
        connected: configured.has(n),
        status: row?.status ?? null,
        last_validated_at: row?.last_validated_at ?? null,
      };
    });
    return NextResponse.json({ networks: all });
  } catch (err) {
    logger.error('[affiliate-networks] GET failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });

export const POST = withRateLimit(async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    // Zod validates payload as Record<string, string> (loose shape); saveCredentials
    // expects the strict per-network NetworkCredentialPayload[N]. The two-step cast
    // bridges via `unknown` because the structural types don't overlap directly —
    // upstream API contract is loose by design. Future: discriminated Zod schema
    // per network would remove this bridge.
    const network = parsed.data.network;
    await saveCredentials(db, user.id, network, parsed.data.payload as unknown as NetworkCredentialPayload[typeof network]);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    logger.error('[affiliate-networks] POST failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } });
