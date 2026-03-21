/**
 * RaaS API Key Management — /api/raas/keys
 *
 * GET  — List API keys for the authenticated user's org
 * POST — Create a new API key (returns raw key once)
 *
 * Auth: Supabase session (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { getOrgId } from '@/lib/org';
import { listApiKeys, createApiKey } from '@/lib/raas/api-key-manager';

export const dynamic = 'force-dynamic';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getOrgId(user.id, createServerClient());
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const keys = await listApiKeys(orgId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error('GET /api/raas/keys error:', err);
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getOrgId(user.id, createServerClient());
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { key, id } = await createApiKey(orgId, name);

    return NextResponse.json(
      { id, key, message: 'Store this key securely — it will not be shown again.' },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/raas/keys error:', err);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
