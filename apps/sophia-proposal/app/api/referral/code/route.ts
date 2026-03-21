/**
 * GET /api/referral/code  — return org's referral code (create if not exists)
 * POST /api/referral/code — generate a brand-new code for org
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserOrganization } from '@/lib/db/auth';
import { createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

// Format: sophia-{orgSlug}-{random4}
function generateCode(slug: string): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const safeSlug = slug.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  return `sophia-${safeSlug}-${random}`;
}

async function getAuthenticatedOrg(request: NextRequest) {
  const cookie = request.headers.get('cookie') || '';
  const user = await getCurrentUser(cookie);
  if (!user) return { org: null, error: 'Unauthorized', status: 401 };

  const org = await getUserOrganization(user.id);
  if (!org) return { org: null, error: 'Organization not found', status: 404 };

  return { org, error: null, status: 200 };
}

/**
 * GET — return existing code or auto-create one
 */
export async function GET(request: NextRequest) {
  try {
    const { org, error, status } = await getAuthenticatedOrg(request);
    if (!org) return NextResponse.json({ error }, { status });

    const db = createServerClient();

    // Look for existing active code
    const { data: existing } = await db
      .from('referral_codes')
      .select('*')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json({ code: existing });
    }

    // Auto-create on first access
    const code = generateCode(org.slug);
    const { data: created, error: insertErr } = await db
      .from('referral_codes')
      .insert({ org_id: org.id, code, commission_rate: 0.20 })
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ code: created });
  } catch (e) {
    console.error('GET /api/referral/code error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — generate a fresh code (deactivates previous)
 */
export async function POST(request: NextRequest) {
  try {
    const { org, error, status } = await getAuthenticatedOrg(request);
    if (!org) return NextResponse.json({ error }, { status });

    const db = createServerClient();

    // Deactivate existing codes
    await db
      .from('referral_codes')
      .update({ is_active: false })
      .eq('org_id', org.id);

    // Create new code
    const code = generateCode(org.slug);
    const { data: created, error: insertErr } = await db
      .from('referral_codes')
      .insert({ org_id: org.id, code, commission_rate: 0.20 })
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ code: created }, { status: 201 });
  } catch (e) {
    console.error('POST /api/referral/code error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
