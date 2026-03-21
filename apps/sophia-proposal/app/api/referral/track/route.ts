/**
 * POST /api/referral/track
 *
 * Track referral events (click, signup) — no auth required for clicks.
 * Uses service-role client to bypass RLS for public tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TrackSchema = z.object({
  code: z.string().min(1).max(100),
  event_type: z.enum(['click', 'signup']),
  metadata: z.record(z.unknown()).optional().default({}),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = TrackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { code, event_type, metadata } = parsed.data;
    const db = createServerClient();

    // Look up the referral code to get referrer_org_id
    const { data: referralCode, error: codeErr } = await db
      .from('referral_codes')
      .select('id, org_id, is_active')
      .eq('code', code)
      .single();

    if (codeErr || !referralCode) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    if (!referralCode.is_active) {
      return NextResponse.json({ error: 'Referral code is inactive' }, { status: 410 });
    }

    // Enrich metadata with request context
    const enrichedMeta = {
      ...metadata,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
    };

    // Record the event
    const { error: eventErr } = await db
      .from('referral_events')
      .insert({
        referrer_org_id: referralCode.org_id,
        referral_code: code,
        event_type,
        metadata: enrichedMeta,
      });

    if (eventErr) {
      console.error('Failed to insert referral_event:', eventErr);
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
    }

    // Atomically increment the counter on referral_codes
    const field = event_type === 'click' ? 'clicks' : 'signups';
    await db.rpc('increment_referral_counter', {
      p_code: code,
      p_field: field,
    });

    return NextResponse.json({ tracked: true });
  } catch (e) {
    console.error('POST /api/referral/track error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
