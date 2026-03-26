/**
 * RaaS API Key — /api/raas/keys/[id]
 *
 * DELETE — Revoke a specific API key by ID
 *
 * Auth: JWT cookie (auth-token)
 * Note: Next.js 15 — params is a Promise, must be awaited
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeApiKey } from '@/lib/raas/api-key-manager';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyJwt } = await import('@/lib/db/auth-verify');
    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getUserOrganization } = await import('@/lib/db/auth');
    const org = await getUserOrganization(payload.sub as string);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const revoked = await revokeApiKey(id, org.id);
    if (!revoked) {
      return NextResponse.json({ error: 'Failed to revoke key or key not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('DELETE /api/raas/keys/[id] error:', err);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
