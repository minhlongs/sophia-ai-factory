/**
 * @file b2b-outreach-actions.ts
 * @description Server Actions for B2B Multi-Channel Cold Outreach Engine
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { isCorporateDomain } from '@/tree/outreach/b2b-warmup-engine';
import type { OutreachChannel } from '@/seed/types/growth-triad-v3-types';

export async function dispatchB2bOutreachAction(params: {
  email: string;
  fullName?: string;
  companyDomain: string;
  channel: OutreachChannel;
  bookingUrl?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const isCorporate = isCorporateDomain(params.companyDomain);
  const now = Date.now();
  const leadId = `lead_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const db = createServerClient();

  await db
    .prepare(
      `INSERT INTO b2b_lead_records (
         id, user_id, email, full_name, company_domain,
         is_corporate_domain, intent_score, status, channel,
         warmup_ramp_day, booking_url, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      leadId,
      user.id,
      params.email,
      params.fullName || null,
      params.companyDomain,
      isCorporate ? 1 : 0,
      isCorporate ? 85 : 20,
      isCorporate ? 'WARMING' : 'BOUNCED',
      params.channel,
      1,
      params.bookingUrl || null,
      now,
      now
    )
    .run();

  await inngest.send({
    name: 'b2b.outreach.dispatched',
    data: {
      leadId,
      userId: user.id,
      email: params.email,
      channel: params.channel,
      rampDay: 1,
      intentScore: isCorporate ? 85 : 20,
    },
  });

  return { success: true, leadId, isCorporateDomain: isCorporate };
}
