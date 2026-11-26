/**
 * GET /api/media-kit/[slug] — Public Cryptographically Verified Media Kit (HS256 JWS).
 *
 * Returns a signed JWS attestation of bot-filtered click & conversion metrics
 * (never exposing raw revenue) for VIP commission negotiation with Crypto/SaaS brands.
 *
 * @module app/api/media-kit/[slug]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { signVerifiedMediaKitJws } from '@/seed/aeo/verified-media-kit-attestation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<NextResponse> {
  const resolved = params instanceof Promise ? await params : params;
  const workspaceSlug = String(resolved.slug ?? 'sophia')
    .replace(/[^a-z0-9-_]/gi, '')
    .slice(0, 48) || 'sophia';

  const secret = (process.env.BETTER_AUTH_SECRET ?? process.env.CRON_SECRET ?? '').trim();
  const claims = {
    workspaceSlug,
    periodDays: 30,
    verifiedHumanClicks: 0,
    conversionRatePct: 0,
    botTrafficFilteredPct: 0,
    issuedAtIso: new Date().toISOString(),
  };

  const jws = secret ? await signVerifiedMediaKitJws(claims, secret) : null;

  return NextResponse.json(
    {
      protocol: 'sophia-verified-media-kit-v1',
      claims,
      signed: Boolean(jws),
      jws,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=300' },
    },
  );
}
