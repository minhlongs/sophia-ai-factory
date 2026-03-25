/**
 * Referral system queries — fetch codes, events, and stats for dashboard.
 */

import { getD1Client } from '@/lib/db/client';

export interface ReferralCode {
  id: string;
  code: string;
  max_uses: number;
  current_uses: number;
  reward_amount: number;
  is_active: boolean;
  created_at: string;
}

export interface ReferralEvent {
  id: string;
  referral_code_id: string;
  referred_org_id: string;
  event_type: 'signup' | 'conversion' | 'payout';
  amount: number;
  created_at: string;
}

export interface ReferralStats {
  totalSignups: number;
  totalConversions: number;
  totalEarnings: number;
  conversionRate: number;
}

export async function getReferralCodes(orgId: string): Promise<ReferralCode[]> {
  const db = await getD1Client();
  const { data } = await db
    .from('referral_codes')
    .select('*')
    .eq('org_id', orgId);
  return (data ?? []) as unknown as ReferralCode[];
}

export async function getReferralEvents(codeId: string): Promise<ReferralEvent[]> {
  const db = await getD1Client();
  const { data } = await db
    .from('referral_events')
    .select('*')
    .eq('referral_code_id', codeId);
  return (data ?? []) as unknown as ReferralEvent[];
}

export async function getReferralStats(orgId: string): Promise<ReferralStats> {
  const codes = await getReferralCodes(orgId);
  if (codes.length === 0) {
    return { totalSignups: 0, totalConversions: 0, totalEarnings: 0, conversionRate: 0 };
  }

  let totalSignups = 0;
  let totalConversions = 0;
  let totalEarnings = 0;

  for (const code of codes) {
    const events = await getReferralEvents(code.id);
    for (const e of events) {
      if (e.event_type === 'signup') totalSignups++;
      if (e.event_type === 'conversion') totalConversions++;
      if (e.event_type === 'payout') totalEarnings += e.amount;
    }
  }

  return {
    totalSignups,
    totalConversions,
    totalEarnings,
    conversionRate: totalSignups > 0 ? (totalConversions / totalSignups) * 100 : 0,
  };
}

export async function createReferralCode(orgId: string): Promise<ReferralCode | null> {
  const db = await getD1Client();
  const code = `REF_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  try {
    await db.from('referral_codes').insert({
      org_id: orgId,
      code,
      max_uses: 100,
      current_uses: 0,
      reward_amount: 20, // 20% revenue share
      is_active: true,
    });

    const { data } = await db
      .from('referral_codes')
      .select('*')
      .eq('code', code)
      .single();

    return data as ReferralCode | null;
  } catch {
    return null;
  }
}
