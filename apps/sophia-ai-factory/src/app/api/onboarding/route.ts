/**
 * Onboarding API — track + manage customer onboarding progress
 *
 * GET  /api/onboarding?tenantId=<id>     → current status
 * POST /api/onboarding                    → start onboarding for new tenant
 *
 * Auth: administrator session required (onboarding records contain tenant-wide contacts and pilot data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/admin';
import { createServerClient } from '@/seed/db/client';
import {
  startSchema,
  formatTenantOnboardingStatus,
  sendWelcomeEmail,
  type TenantOnboardingRow,
} from './onboarding-helpers';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const db = createServerClient();

    const { data: tenant } = (await db
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()) as { data: TenantOnboardingRow | null };

    if (!tenant) {
      return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
    }

    return NextResponse.json(formatTenantOnboardingStatus(tenantId, tenant));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { tenantId, tenantName, ceoEmail, ceoName, amEmail, tier, pilotStartDate } = parsed.data;
    const db = createServerClient();
    const now = new Date().toISOString();
    const pilotEnd = pilotStartDate
      ? new Date(new Date(pilotStartDate).getTime() + 84 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await db
      .from('tenants')
      .upsert({
        id: tenantId,
        name: tenantName,
        ceo_email: ceoEmail,
        ceo_name: ceoName,
        am_email: amEmail ?? auth.user.email,
        tier: tier ?? 'BASIC',
        onboarding_status: 'in_progress',
        onboarding_started_at: now,
        pilot_start_date: pilotStartDate ?? now,
        pilot_end_date: pilotEnd,
        updated_at: now,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    sendWelcomeEmail(tenantId, ceoEmail, ceoName, amEmail ?? auth.user.email).catch(() => {
      // non-critical — AM can resend
    });

    return NextResponse.json({
      success: true,
      tenantId,
      status: 'in_progress',
      pilotStartDate: pilotStartDate ?? now,
      pilotEndDate: pilotEnd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
