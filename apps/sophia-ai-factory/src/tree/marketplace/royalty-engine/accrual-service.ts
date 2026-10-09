/**
 * @file accrual-service.ts
 * @description 70/30 royalty accruals with OCC CAS on creator earnings ledger.
 * @layer tree
 */

import { logger } from '@/seed/utils/logger-utility';
import type { RoyaltyAccrualInput, RoyaltyAccrualResult } from '../types';
import { DEFAULT_ROYALTY_PCT, MAX_CAS_RETRIES } from './constants';
import { calculateRoyaltySplit, isSelfTemplateActivation } from './split-calculator';

/**
 * Executes a 70/30 template activation royalty accrual with OCC CAS on creator_earnings_ledger.
 */
export async function accrueRoyalty(input: RoyaltyAccrualInput): Promise<RoyaltyAccrualResult> {
  const nowMs = input.nowMs ?? Date.now();

  // 1. Anti-circular self-activation check
  if (isSelfTemplateActivation(input.creatorId, input.activatingUserId)) {
    throw new Error('SELF_TEMPLATE_ACTIVATION_PROHIBITED');
  }

  // 2. Compute 70/30 split
  const split = calculateRoyaltySplit(input.priceCents, input.royaltyPct ?? DEFAULT_ROYALTY_PCT);
  const activationId = input.referenceId || `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  const eventType = 'royalty_accrual';
  const sourceType = 'template_activation';

  // 3. Fast path: probe existing entry for idempotency
  try {
    const existing = await input.db
      .prepare(
        `SELECT id, balance_after_cents, sequence_num, amount_cents
         FROM creator_earnings_ledger
         WHERE creator_id = ? AND reference_id = ? AND event_type = ?
         LIMIT 1`,
      )
      .bind(input.creatorId, activationId, eventType)
      .first<{
        id: string;
        balance_after_cents?: number;
        sequence_num?: number;
        amount_cents?: number;
      }>();

    if (existing) {
      return {
        success: true,
        activationId,
        creatorCents: existing.amount_cents ?? split.creatorCents,
        platformCents: split.platformCents,
        ledgerId: existing.id,
        sequenceNum: existing.sequence_num ?? 1,
        balanceAfterCents: existing.balance_after_cents ?? split.creatorCents,
      };
    }
  } catch {
    // Proceed if table doesn't have existing record
  }

  // 4. OCC CAS Insertion Loop
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    try {
      // Re-probe on retry
      if (attempt > 0) {
        const retryExisting = await input.db
          .prepare(
            `SELECT id, balance_after_cents, sequence_num, amount_cents
             FROM creator_earnings_ledger
             WHERE creator_id = ? AND reference_id = ? AND event_type = ?
             LIMIT 1`,
          )
          .bind(input.creatorId, activationId, eventType)
          .first<{
            id: string;
            balance_after_cents?: number;
            sequence_num?: number;
            amount_cents?: number;
          }>();

        if (retryExisting) {
          return {
            success: true,
            activationId,
            creatorCents: retryExisting.amount_cents ?? split.creatorCents,
            platformCents: split.platformCents,
            ledgerId: retryExisting.id,
            sequenceNum: retryExisting.sequence_num ?? 1,
            balanceAfterCents: retryExisting.balance_after_cents ?? split.creatorCents,
          };
        }
      }

      // Read current tail sequence and balance
      const tail = await input.db
        .prepare(
          `SELECT sequence_num, balance_after_cents
           FROM creator_earnings_ledger
           WHERE creator_id = ?
           ORDER BY sequence_num DESC, created_at DESC
           LIMIT 1`,
        )
        .bind(input.creatorId)
        .first<{ sequence_num?: number; balance_after_cents?: number }>();

      const lastSeq = tail?.sequence_num ?? 0;
      const lastBal = tail?.balance_after_cents ?? 0;

      const nextSeq = lastSeq + 1;
      const nextBal = lastBal + split.creatorCents;
      const ledgerId = `led_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

      const metadataJson = JSON.stringify({
        templateId: input.templateId,
        activatingUserId: input.activatingUserId,
        tenantId: input.tenantId,
        videoJobId: input.videoJobId,
        priceCents: input.priceCents,
        creatorCents: split.creatorCents,
        platformCents: split.platformCents,
        royaltyPct: input.royaltyPct ?? DEFAULT_ROYALTY_PCT,
      });

      await input.db
        .prepare(
          `INSERT INTO creator_earnings_ledger (
            id, creator_id, amount_cents, currency, event_type, source_type,
            reference_id, balance_after_cents, status, sequence_num,
            metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          ledgerId,
          input.creatorId,
          split.creatorCents,
          'USD',
          eventType,
          sourceType,
          activationId,
          nextBal,
          'pending',
          nextSeq,
          metadataJson,
          nowMs,
        )
        .run();

      return {
        success: true,
        activationId,
        creatorCents: split.creatorCents,
        platformCents: split.platformCents,
        ledgerId,
        sequenceNum: nextSeq,
        balanceAfterCents: nextBal,
      };
    } catch (err: unknown) {
      const errStr = String(err);
      const isConstraintError =
        errStr.includes('UNIQUE') ||
        errStr.includes('PRIMARY KEY') ||
        errStr.includes('constraint') ||
        errStr.includes('SQLITE_CONSTRAINT');

      if (isConstraintError && attempt < MAX_CAS_RETRIES - 1) {
        const maxWait = 10 * Math.pow(2, attempt);
        const delay = Math.floor(Math.random() * maxWait) + Math.floor(Math.random() * 15);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      logger.error('[royalty-engine] CAS accrual failed after retries', {
        creatorId: input.creatorId,
        attempt,
        error: errStr,
      });

      throw err;
    }
  }

  throw new Error('ROYALTY_ACCRUAL_CAS_EXHAUSTED');
}
