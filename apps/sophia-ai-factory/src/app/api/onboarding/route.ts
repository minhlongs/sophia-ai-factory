/**
 * Onboarding API — track + manage customer onboarding progress
 *
 * GET  /api/onboarding?tenantId=<id>     → current status
 * POST /api/onboarding                    → start onboarding for new tenant
 *
 * Auth: required (getCurrentUser)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';

const startSchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  ceoEmail: z.string().email(),
  ceoName: z.string().min(1),
  amEmail: z.string().email().optional(),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE']).optional(),
  pilotStartDate: z.string().datetime().optional(),
});

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const db = createServerClient();

    const { data: tenant } = await db
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single() as { data: { onboarding_status: string; onboarding_started_at: string; onboarding_completed_at: string | null; pilot_start_date: string | null; pilot_end_date: string | null; tier: string; ceo_email: string; ceo_name: string; am_email: string | null } | null };

    if (!tenant) {
      return NextResponse.json({ error: 'tenant not found' }, { status: 404 });
    }

    // Compute day-in-pilot
    const pilotStart = tenant.pilot_start_date
      ? new Date(tenant.pilot_start_date)
      : new Date(tenant.onboarding_started_at);
    const now = new Date();
    const dayInPilot = Math.floor(
      (now.getTime() - pilotStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const status: 'not_started' | 'in_progress' | 'completed' | 'paused' =
      tenant.onboarding_completed_at ? 'completed'
      : tenant.onboarding_status === 'paused' ? 'paused'
      : tenant.onboarding_started_at ? 'in_progress'
      : 'not_started';

    return NextResponse.json({
      tenantId,
      status,
      dayInPilot: Math.max(0, dayInPilot),
      tier: tenant.tier,
      ceoName: tenant.ceo_name,
      ceoEmail: tenant.ceo_email,
      amEmail: tenant.am_email,
      pilotStartDate: tenant.pilot_start_date,
      pilotEndDate: tenant.pilot_end_date,
      onboardingStartedAt: tenant.onboarding_started_at,
      onboardingCompletedAt: tenant.onboarding_completed_at,
      nextMilestone: getNextMilestone(dayInPilot),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
      ? new Date(new Date(pilotStartDate).getTime() + 84 * 24 * 60 * 60 * 1000).toISOString() // +12 weeks
      : null;

    const { error } = await db
      .from('tenants')
      .upsert({
        id: tenantId,
        name: tenantName,
        ceo_email: ceoEmail,
        ceo_name: ceoName,
        am_email: amEmail ?? user.email,
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

    // Trigger welcome email (async, don't block response)
    sendWelcomeEmail(tenantId, ceoEmail, ceoName, amEmail ?? user.email).catch(() => {
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

// -- Helpers --

function getNextMilestone(day: number): string | null {
  if (day < 0) return 'Day 0: Contract signed';
  if (day < 1) return 'Day 1-3: Welcome + Discovery';
  if (day < 4) return 'Day 1-3: Discovery call';
  if (day < 8) return 'Day 4-7: Setup + Integration';
  if (day < 15) return 'Day 8-14: First value + Training';
  if (day < 28) return 'Week 3-4: First checkpoint';
  if (day < 56) return 'Week 8: Mid-pilot review';
  if (day < 70) return 'Week 10: 90-day report';
  if (day < 84) return 'Week 12: Decision call';
  return 'Pilot complete — renewal decision';
}

async function sendWelcomeEmail(
  _tenantId: string,
  ceoEmail: string,
  ceoName: string,
  amEmail: string,
): Promise<void> {
 // PLANNED: Wire to email service (Resend/SendGrid) in Phase 3
 // Template: docs/onboarding/templates/welcome-email.md
 logger.info('[onboarding] Welcome email queued', { ceoEmail, amEmail });
}
