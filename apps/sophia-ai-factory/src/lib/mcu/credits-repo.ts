/**
 * MCU (Model Compute Units) Credit Repository
 *
 * Provides atomic balance operations against user_mcu_balance
 * and append-only transaction ledger in mcu_transactions.
 *
 * All mutations are safe for concurrent Workers execution:
 * - deductCredits uses WHERE remaining >= amount guard
 * - addCredits always succeeds (INSERT OR REPLACE + UPDATE)
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
}

interface BalanceRow {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
}

/**
 * Get current MCU balance for a user.
 * Returns zeroed balance if no row exists.
 */
export async function getBalance(userId: string): Promise<McuBalance> {
  const db = createServerClient();
  try {
    const { data } = await db
      .from('user_mcu_balance')
      .select('credits_remaining, credits_total_purchased, credits_total_used')
      .eq('user_id', userId)
      .single() as { data: BalanceRow | null; error: unknown };

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
 * Atomically deduct credits from user balance.
 * Returns false if insufficient credits.
 * Records transaction on success.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  missionId: string,
  reason: string,
): Promise<boolean> {
  if (amount <= 0) return true;

  const db = createServerClient();
  try {
    // Atomic deduct using D1 raw SQL
    const d1 = db as unknown as { prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<{ meta: { changes: number } }> } } };

    const stmt = d1.prepare(
      `UPDATE user_mcu_balance
       SET credits_remaining = credits_remaining - ?,
           credits_total_used = credits_total_used + ?,
           updated_at = strftime('%s','now')
       WHERE user_id = ? AND credits_remaining >= ?`
    );
    const result = await stmt.bind(amount, amount, userId, amount).run();

    if (result.meta.changes === 0) {
      logger.debug('[MCU] Insufficient credits or no balance row', { userId, amount });
      return false;
    }

    // Record transaction
    await db.from('mcu_transactions').insert({
      user_id: userId,
      delta: -amount,
      reason,
      mission_id: missionId,
      metadata: JSON.stringify({ auto: true }),
    });

    return true;
  } catch (err) {
    logger.error('[MCU] deductCredits error', err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Add credits to user balance (for purchases, refunds, monthly resets).
 * Creates balance row if it does not exist.
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (amount <= 0) return;

  const db = createServerClient();
  try {
    const d1 = db as unknown as { prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } } };

    // Upsert balance row
    await d1.prepare(
      `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
       VALUES (?, ?, ?, strftime('%s','now'))
       ON CONFLICT(user_id) DO UPDATE SET
         credits_remaining = credits_remaining + excluded.credits_remaining,
         credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
         updated_at = strftime('%s','now')`
    ).bind(userId, amount, amount).run();

    // Record transaction
    await db.from('mcu_transactions').insert({
      user_id: userId,
      delta: amount,
      reason,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    logger.error('[MCU] addCredits error', err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * List recent MCU transactions for a user.
 */
export async function listTransactions(
  userId: string,
  limit = 20,
): Promise<Array<{ id: string; delta: number; reason: string; mission_id: string | null; created_at: number }>> {
  const db = createServerClient();
  try {
    const { data } = await db
      .from('mcu_transactions')
      .select('id, delta, reason, mission_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit) as { data: Array<{ id: string; delta: number; reason: string; mission_id: string | null; created_at: number }> | null; error: unknown };
    return data ?? [];
  } catch {
    return [];
  }
}
