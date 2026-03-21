/**
 * RaaS API Key — /api/raas/keys/[id]
 *
 * DELETE — Revoke a specific API key by ID
 *
 * Auth: Supabase session (dashboard users only)
 * Note: Next.js 15 — params is a Promise, must be awaited
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { getOrgId } from '@/lib/org';
import { revokeApiKey } from '@/lib/raas/api-key-manager';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const revoked = await revokeApiKey(id, orgId);
    if (!revoked) {
      return NextResponse.json({ error: 'Failed to revoke key or key not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('DELETE /api/raas/keys/[id] error:', err);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
