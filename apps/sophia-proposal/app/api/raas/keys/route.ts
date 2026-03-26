/**
 * RaaS API Key Management — /api/raas/keys
 *
 * GET  — List API keys for the authenticated user's org
 * POST — Create a new API key (returns raw key once)
 *
 * Auth: JWT cookie (auth-token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listApiKeys, createApiKey } from '@/lib/raas/api-key-manager';

export const dynamic = 'force-dynamic';

/** Extract userId and orgId from JWT cookie */
async function getAuthContext(): Promise<{ userId: string; orgId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;

  try {
    const { verifyJwt } = await import('@/lib/db/auth-verify');
    const payload = await verifyJwt(token);
    if (!payload?.sub) return null;

    const { getUserOrganization } = await import('@/lib/db/auth');
    const org = await getUserOrganization(payload.sub as string);
    if (!org) return null;

    return { userId: payload.sub as string, orgId: org.id };
  } catch {
    return null;
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await listApiKeys(auth.orgId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error('GET /api/raas/keys error:', err);
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { key, id } = await createApiKey(auth.orgId, name);

    return NextResponse.json(
      { id, key, message: 'Store this key securely — it will not be shown again.' },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/raas/keys error:', err);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
