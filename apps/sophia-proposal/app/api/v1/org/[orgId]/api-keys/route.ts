/**
 * POST /api/v1/org/:orgId/api-keys
 *
 * Generates a new API key for the org (requires existing API key auth).
 * Response: { api_key, key_prefix, created_at }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/raas/api-key-manager';
import { generateOrgApiKey } from '@/lib/raas/onboarding';

export const dynamic = 'force-dynamic';

// ── Auth helper ────────────────────────────────────────────────────────────────

function extractApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const auth = await validateApiKey(rawKey);
  if (!auth.valid || !auth.orgId) {
    return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
  }

  // Org-scoped: key must belong to same org
  if (auth.orgId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await generateOrgApiKey(orgId);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/v1/org/[orgId]/api-keys error:', err);
    return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}
