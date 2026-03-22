/**
 * Balance Checker
 *
 * Validates MCU balance and returns HTTP 402 response on zero/negative balance.
 */

import { NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import type { OrgBalance } from '@/lib/db/types';

export interface BalanceStatus {
  orgId: string;
  balance: number;
  lifetimeCredits: number;
  lifetimeUsed: number;
  hasSufficientBalance: boolean;
}

/**
 * Check organization balance
 */
export async function checkBalance(orgId: string): Promise<BalanceStatus | null> {
  const db = await getD1Client();

  const { data, error } = await db
    .from<OrgBalance>('org_balances')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    orgId: data.org_id,
    balance: data.balance,
    lifetimeCredits: data.lifetime_credits,
    lifetimeUsed: data.lifetime_used,
    hasSufficientBalance: data.balance > 0,
  };
}

/**
 * Middleware-style balance check
 * Returns 402 response if balance is zero or negative
 */
export function requireBalance(
  balance: BalanceStatus | null,
  message?: string
): NextResponse | null {
  if (!balance || !balance.hasSufficientBalance) {
    return NextResponse.json(
      {
        error: message || 'Insufficient MCU balance',
        code: 'INSUFFICIENT_BALANCE',
        currentBalance: balance?.balance || 0,
        requiredBalance: 1,
        rechargeUrl: '/billing/upgrade',
      },
      { status: 402 } // Payment Required
    );
  }

  return null; // Balance OK, continue
}

/**
 * Get or initialize balance for an organization
 */
export async function getOrInitializeBalance(
  orgId: string
): Promise<BalanceStatus> {
  const db = await getD1Client();

  // Try to get existing balance
  const { data: existing } = await db
    .from<OrgBalance>('org_balances')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (existing) {
    return {
      orgId: existing.org_id,
      balance: existing.balance,
      lifetimeCredits: existing.lifetime_credits,
      lifetimeUsed: existing.lifetime_used,
      hasSufficientBalance: existing.balance > 0,
    };
  }

  // Initialize with zero balance
  await db.from('org_balances').insert({
    org_id: orgId,
    balance: 0,
    lifetime_credits: 0,
    lifetime_used: 0,
  });

  return {
    orgId,
    balance: 0,
    lifetimeCredits: 0,
    lifetimeUsed: 0,
    hasSufficientBalance: false,
  };
}

/**
 * Add bonus MCU (for promotions, referrals, etc.)
 */
export async function addBonusMcu(
  orgId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  const db = await getD1Client();

  const { error } = await db.rpc('credit_mcu_balance', {
    p_org_id: orgId,
    p_amount: amount,
    p_subscription_id: `bonus:${reason}`,
  });

  return !error;
}
