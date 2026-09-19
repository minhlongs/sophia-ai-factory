/**
 * BYOK Key Rotation Endpoint
 *
 * Canonical route per development roadmap and enterprise specifications.
 * Supports automated AES-256-GCM master key rotation with a 7-day dual-decrypt window,
 * triggering Inngest background re-encryption and logging SOC 2 CC7.2 audit events.
 *
 * Re-exports/delegates to POST /api/admin/keys/rotate.
 * Supports GET for active key version status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getActiveKeyVersion } from '@/tree/byok/byok-crypto';
import { POST as rotatePost } from '@/app/api/admin/keys/rotate/route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  // If request has empty body, synthesize valid JSON object so rotation proceeds smoothly
  const text = await request.text().catch(() => '');
  if (!text || text.trim() === '') {
    const headers = new Headers(request.headers);
    headers.set('content-type', 'application/json');
    const fallbackRequest = new NextRequest(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: 'Admin BYOK rotation' }),
    });
    return rotatePost(fallbackRequest);
  }

  const populatedRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: text,
  });
  return rotatePost(populatedRequest);
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;

  const activeVersion = await getActiveKeyVersion();

  return NextResponse.json({
    status: 'ready',
    activeVersion,
    dualDecryptWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    keyType: 'master',
    algorithm: 'AES-256-GCM',
  });
}
