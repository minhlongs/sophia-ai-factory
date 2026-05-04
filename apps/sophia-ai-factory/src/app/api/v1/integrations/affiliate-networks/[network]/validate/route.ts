/**
 * POST /api/v1/integrations/affiliate-networks/[network]/validate
 * Tests stored credentials against the live network API.
 * @module app/api/v1/integrations/affiliate-networks/[network]/validate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { validateCredentials, AffiliateNetwork } from '@/lib/affiliates/credentials';
import { logger } from '@/seed/utils/logger-utility';

export const runtime = 'edge';
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

const VALID_NETWORKS = new Set<string>([
  'impact_radius','partnerstack','cj','shareasale','clickbank',
  'binance','bybit','bitget','coinbase',
]);

type Params = { params: Promise<{ network: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { network } = await params;
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!VALID_NETWORKS.has(network))
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const result = await validateCredentials(db, user.id, network as AffiliateNetwork);
    return NextResponse.json(result, { status: result.valid ? 200 : 422 });
  } catch (err) {
    logger.error('[affiliate-networks] validate failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
