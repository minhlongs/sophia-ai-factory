/**
 * MCU (Model Compute Units) Credit Queries
 *
 * Read-only balance and transaction ledger queries extracted from credits-repo.ts.
 */

import { createServerClient } from '@/seed/db/client';

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
}

export interface McuTransactionRow {
  id: string;
  delta: number;
  reason: string;
  mission_id: string | null;
  created_at: number;
}

/**
 * Get current MCU balance for a user.
 * Returns zeroed balance if no row exists.
 */
export async function getBalance(userId: string): Promise<McuBalance> {
  const db = createServerClient();
  try {
    const { data } = (await db
      .from('user_mcu_balance')
      .select('credits_remaining, credits_total_purchased, credits_total_used')
      .eq('user_id', userId)
      .single()) as { data: McuBalance | null; error: unknown };

    if (!data) {
      return { credits_remaining: 0, credits_total_purchased: 0, credits_total_used: 0 };
    }
    return {
      credits_remaining: data.credits_remaining,
      credits_total_purchased: data.credits_total_purchased,
      credits_total_used: data.credits_total_used,
    };
  } catch {
    return { credits_remaining: 0, credits_total_purchased: 0, credits_total_used: 0 };
  }
}

/**
 * List recent MCU transactions for a user.
 */
export async function listTransactions(
  userId: string,
  limit = 20,
): Promise<Array<McuTransactionRow>> {
  const db = createServerClient();
  try {
    const { data } = (await db
      .from('mcu_transactions')
      .select('id, delta, reason, mission_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)) as { data: Array<McuTransactionRow> | null; error: unknown };
    return data ?? [];
  } catch {
    return [];
  }
}
