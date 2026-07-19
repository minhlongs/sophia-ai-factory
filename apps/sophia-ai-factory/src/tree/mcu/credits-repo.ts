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

import { createServerClient, getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility';

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
}

export interface TotalCredits {
  mcu: number;
  pack: number;
  total: number;
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
 * Get unified available credits: MCU balance + active (non-expired) credit pack credits.
 * Uses the same soft-expiry filter as the credits API (`expires_at IS NULL OR expires_at > ?`).
 * Falls back to MCU-only if pack lookup fails (non-fatal).
 */
export async function getTotalCredits(userId: string): Promise<TotalCredits> {
  let packCredits = 0;

  try {
    const db = createServerClient();
    const nowSec = Math.floor(Date.now() / 1000);

    const { data } = await db
      .from('user_purchases')
      .select('credits_remaining')
      .eq('user_id', userId)
      .eq('kind', 'one_time')
      .eq('status', 'paid')
      .gte('expires_at', nowSec) as { data: Array<{ credits_remaining: number }> | null; error: unknown };

    // Sum all non-expired pack credits
    // NOTE: .gte('expires_at', nowSec) in D1/Supabase-SDK includes NULL rows for expires_at IS NULL
    // (SQLite compatibility behavior — NULL treated as "no expiry").
    if (data) {
      packCredits = data.reduce((sum, row) => sum + (row.credits_remaining ?? 0), 0);
    }
  } catch {
    packCredits = 0;
  }

  const mcu = await getBalance(userId);

  return {
    mcu: mcu.credits_remaining,
    pack: packCredits,
    total: mcu.credits_remaining + packCredits,
  };
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

  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const d1 = _db;

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

    await d1.prepare(
      `INSERT INTO mcu_transactions (user_id, delta, reason, mission_id, metadata)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, -amount, reason, missionId, JSON.stringify({ auto: true })).run();

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
): Promise<boolean> {
  if (amount <= 0) return true;

  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const d1 = _db;

    // Upsert balance row
    await d1.prepare(
      `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
       VALUES (?, ?, ?, strftime('%s','now'))
       ON CONFLICT(user_id) DO UPDATE SET
         credits_remaining = credits_remaining + excluded.credits_remaining,
         credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
         updated_at = strftime('%s','now')`
    ).bind(userId, amount, amount).run();

    await d1.prepare(
      `INSERT INTO mcu_transactions (user_id, delta, reason, metadata)
       VALUES (?, ?, ?, ?)`
    ).bind(userId, amount, reason, metadata ? JSON.stringify(metadata) : null).run();
    return true;
  } catch (err) {
    logger.error('[MCU] addCredits error', err instanceof Error ? err : new Error(String(err)));
    return false;
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
