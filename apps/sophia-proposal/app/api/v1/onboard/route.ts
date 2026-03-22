/**
 * POST /api/v1/onboard
 *
 * Public endpoint — creates org, admin user, API key, seeds 200 MCU credits.
 * Returns: { org_id, api_key, mcu_balance: 200 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrganization, createAdminUser } from '@/lib/raas/onboarding';

export const dynamic = 'force-dynamic';

// ── Validation ─────────────────────────────────────────────────────────────────

function validateBody(body: unknown): { org_name: string; email: string; password: string } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  if (typeof b.org_name !== 'string' || b.org_name.trim().length < 2) return null;
  if (typeof b.email !== 'string' || !b.email.includes('@')) return null;
  if (typeof b.password !== 'string' || b.password.length < 8) return null;

  return {
    org_name: b.org_name.trim(),
    email: b.email.toLowerCase().trim(),
    password: b.password,
  };
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = validateBody(body);
  if (!input) {
    return NextResponse.json(
      { error: 'org_name (min 2 chars), email, and password (min 8 chars) are required' },
      { status: 400 },
    );
  }

  try {
    // Create org + API key + 200 MCU credits
    const { org_id, api_key } = await createOrganization({
      name: input.org_name,
      email: input.email,
      plan: 'starter',
    });

    // Create admin user linked to org
    await createAdminUser({
      org_id,
      email: input.email,
      password: input.password,
    });

    return NextResponse.json(
      { org_id, api_key, mcu_balance: 200 },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/v1/onboard error:', err);
    const message = err instanceof Error ? err.message : 'Onboarding failed';

    // Surface duplicate email/org as 400
    if (message.includes('UNIQUE') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'Email or organization already exists' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
