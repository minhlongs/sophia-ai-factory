/**
 * GET    /api/v1/integrations/affiliate-networks/[network]   — status
 * DELETE /api/v1/integrations/affiliate-networks/[network]   — remove
 * POST   /api/v1/integrations/affiliate-networks/[network]/validate — test creds
 *
 * Note: /validate is handled in its own route file.
 * @module app/api/v1/integrations/affiliate-networks/[network]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { listNetworks, deleteCredentials, AffiliateNetwork } from '@/lib/affiliates/credentials';
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

async function safeGetUser(req: NextRequest) {
  try {
    return await getCurrentUserFromHeaders(req.headers);
  } catch (err) {
    logger.warn('[affiliate-networks] auth lookup threw', { err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { network } = await params;
  const user = await safeGetUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!VALID_NETWORKS.has(network))
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const rows = await listNetworks(db, user.id);
    const row = rows.find(r => r.network === network);
    return NextResponse.json({
      network,
      connected: !!row,
      status: row?.status ?? null,
      last_validated_at: row?.last_validated_at ?? null,
    });
  } catch (err) {
    logger.error('[affiliate-networks] GET [network] failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { network } = await params;
  const user = await safeGetUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!VALID_NETWORKS.has(network))
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    await deleteCredentials(db, user.id, network as AffiliateNetwork);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[affiliate-networks] DELETE failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
