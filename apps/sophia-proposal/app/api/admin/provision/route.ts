/**
 * POST /api/admin/provision
 *
 * Admin-only endpoint — creates client account + org + API key.
 * Auth: JWT cookie + admin role check.
 * Body: { email: string, org_name?: string, mcu_credits?: number }
 * Returns: { org_id, email, api_key, mcu_balance }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function verifyAdmin(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { verifyJwt } = await import('@/lib/db/auth-verify');
    const payload = await verifyJwt(token);
    if (!payload?.sub || !payload?.email) return null;

    // Check admin role in D1
    const { getD1Client } = await import('@/lib/db/client');
    const db = await getD1Client();
    const { data: user } = await db
      .from('users')
      .select('role')
      .eq('id', payload.sub as string)
      .single();

    if (!user || user.role !== 'admin') return null;
    return { userId: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await verifyAdmin(token);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const orgName = typeof body.org_name === 'string' && body.org_name.trim()
    ? body.org_name.trim()
    : email.split('@')[0];
  const validTiers = ['starter', 'growth', 'premium', 'master'];
  const tier = typeof body.tier === 'string' && validTiers.includes(body.tier)
    ? body.tier
    : 'starter';
  const mcuCredits = typeof body.mcu_credits === 'number' && body.mcu_credits > 0
    ? Math.floor(body.mcu_credits)
    : 200;

  try {
    const { createOrganization, createAdminUser } = await import('@/lib/raas/onboarding');

    // Create org + API key
    const { org_id, api_key } = await createOrganization({
      name: orgName,
      email,
      plan: tier,
    });

    // Create user with a temporary password (client will use magic link)
    const tempPassword = `sophia_${crypto.randomUUID().slice(0, 12)}`;
    await createAdminUser({
      org_id,
      email,
      password: tempPassword,
    });

    // Override MCU balance if custom amount
    if (mcuCredits !== 200) {
      const { getD1Client } = await import('@/lib/db/client');
      const db = await getD1Client();
      await db.from('org_balances').update({ balance: mcuCredits }).eq('org_id', org_id);
    }

    return NextResponse.json({
      org_id,
      email,
      org_name: orgName,
      tier,
      api_key,
      mcu_balance: mcuCredits,
      login_url: `https://sophia.agencyos.network/login`,
      note: 'Client can login with magic link using this email',
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed';
    if (message.includes('UNIQUE') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'Email or organization already exists' }, { status: 409 });
    }
    logger.error('Admin provision error', err, { path: '/api/admin/provision' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — list all provisioned clients (admin-only)
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await verifyAdmin(token);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { getD1Client } = await import('@/lib/db/client');
    const db = await getD1Client();
    const { data: orgs } = await db
      .from('organizations')
      .select('id, name, email, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({ clients: orgs || [] });
  } catch {
    return NextResponse.json({ clients: [] });
  }
}
