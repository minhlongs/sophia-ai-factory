/**
 * MCU (Model Compute Units) Credit Repository
 *
 * Provides atomic balance operations against user_mcu_balance
 * and append-only transaction ledger in mcu_transactions.
 *
 * All mutations are safe for concurrent Workers execution:
 * - deductCredits uses WHERE remaining >= amount guard
 * - mission charges bind the original debit and allocations atomically
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { assertPilotDebitEffect, pilotCreditAllocationStatements } from '@/seed/billing/manual-pilot-credit-allocation';
import { failure, success, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';

export { getBalance, listTransactions, type McuBalance } from './credits-queries';

export type MissionDebitError = {
  code: 'invalid_input' | 'storage_uncertain';
  message: string;
};

async function applyPilotAwareDebit(
  d1: D1Database, userId: string, amount: number, reference: string, reason: string,
  orgId?: string, trustedMissionId?: string,
): Promise<boolean> {
  const attempt = crypto.randomUUID();
  const now = new Date().toISOString();
  const claimed = 'EXISTS(SELECT 1 FROM manual_pilot_credit_debits WHERE id=?)';
  const walletShare = '(? - COALESCE((SELECT SUM(amount) FROM manual_pilot_credit_allocations WHERE debit_id=?),0))';
  const [claim] = await d1.batch([
    ...pilotCreditAllocationStatements(d1, userId, amount, attempt, now, orgId, trustedMissionId),
    d1.prepare(`INSERT INTO user_mcu_balance(user_id) SELECT ? WHERE ${claimed}
      ON CONFLICT(user_id) DO NOTHING`).bind(userId, attempt),
    d1.prepare(`UPDATE user_mcu_balance SET credits_remaining=credits_remaining-${walletShare},
      credits_total_used=credits_total_used+?,updated_at=strftime('%s','now')
      WHERE user_id=? AND ${claimed} AND credits_remaining>=${walletShare}`)
      .bind(amount, attempt, amount, userId, attempt, amount, attempt),
    assertPilotDebitEffect(d1, attempt, 'changes()=1'),
    d1.prepare(`INSERT INTO mcu_transactions(${trustedMissionId ? 'id,' : ''}user_id,delta,reason,mission_id,metadata)
      SELECT ${trustedMissionId ? '?,' : ''}?,?,?,?,? WHERE ${claimed}`)
      .bind(...(trustedMissionId ? [attempt] : []), userId, -amount, reason, reference,
        JSON.stringify({ auto: true, pilotDebitId: attempt }), attempt),
    assertPilotDebitEffect(d1, attempt, 'changes()=1'),
    ...(trustedMissionId ? [
      d1.prepare(`INSERT INTO mcu_mission_debits(mission_id,debit_id,org_id)
        SELECT ?,?,? WHERE ${claimed}`).bind(trustedMissionId, attempt, orgId ?? null, attempt),
      assertPilotDebitEffect(d1, attempt, 'changes()=1'),
    ] : []),
  ]);
  return claim.meta.changes === 1;
}

/** Server-owned mission charge. Public debit references cannot create this link. */
export async function deductMissionCredits(
  userId: string, amount: number, missionId: string, reason: string, orgId?: string,
): Promise<Result<boolean, MissionDebitError>> {
  if (!Number.isFinite(amount) || amount <= 0 || !missionId) {
    return failure({ code: 'invalid_input', message: 'Invalid mission debit parameters' });
  }
  try {
    const d1 = await getD1();
    if (!d1) throw new Error('D1 database binding not available');
    return success(await applyPilotAwareDebit(d1, userId, amount, missionId, reason, orgId, missionId));
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[MCU] deductMissionCredits error', error);
    return failure({ code: 'storage_uncertain', message: error.message });
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
  orgId?: string,
): Promise<boolean> {
  if (!Number.isFinite(amount)) return false;
  if (amount <= 0) return true;

  try {
    const d1 = await getD1();
    if (!d1) throw new Error('D1 database binding not available');

    const pilotSchema = await d1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='manual_pilot_credit_debits'")
      .first<{name:string}>();
    if (pilotSchema) {
      return await applyPilotAwareDebit(d1, userId, amount, missionId, reason, orgId);
    }
    const stmt = d1.prepare(
      `UPDATE user_mcu_balance
       SET credits_remaining = credits_remaining - ?,
           credits_total_used = credits_total_used + ?,
           updated_at = strftime('%s','now')
       WHERE user_id = ? AND credits_remaining >= ?`
    );
    const [result] = await d1.batch([
      stmt.bind(amount, amount, userId, amount),
      d1.prepare(
        `INSERT INTO mcu_transactions (user_id, delta, reason, mission_id, metadata)
         SELECT ?, ?, ?, ?, ? WHERE changes() = 1`,
      ).bind(userId, -amount, reason, missionId, JSON.stringify({ auto: true })),
    ]);

    if (result.meta.changes === 0) {
      logger.debug('[MCU] Insufficient credits or no balance row', { userId, amount });
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[MCU] deductCredits error', err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Add credits to the shared wallet. Mission reversals must restore their original sources.
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
    const d1 = await getD1();
    if (!d1) throw new Error('D1 database binding not available');

    await d1
      .prepare(
        `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
         VALUES (?, ?, ?, strftime('%s','now'))
         ON CONFLICT(user_id) DO UPDATE SET
           credits_remaining = credits_remaining + excluded.credits_remaining,
           credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
           updated_at = strftime('%s','now')`
      )
      .bind(userId, amount, amount)
      .run();

    await d1
      .prepare(
        `INSERT INTO mcu_transactions (user_id, delta, reason, metadata)
         VALUES (?, ?, ?, ?)`
      )
      .bind(userId, amount, reason, metadata ? JSON.stringify(metadata) : null)
      .run();
    return true;
  } catch (err) {
    logger.error('[MCU] addCredits error', err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}
