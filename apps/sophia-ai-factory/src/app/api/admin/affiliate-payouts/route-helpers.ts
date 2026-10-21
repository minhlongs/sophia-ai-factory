/**
 * Admin Affiliate Payout Mutation Helpers
 *
 * Approve / reject transitions for `affiliate_payouts` awaiting admin
 * sign-off. Both transitions use Optimistic Concurrency Control on `version`
 * so two admins acting on the same row cannot silently overwrite one another.
 *
 * Layer: app/api/admin (route support)
 *
 * @module app/api/admin/affiliate-payouts/route-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

/** Statuses an admin may act on. */
export const ACTIONABLE_STATUSES = ['draft', 'pending_approval'] as const;
export type ActionableStatus = (typeof ACTIONABLE_STATUSES)[number];

export interface PayoutListRow {
  id: string;
  payout_reference: string;
  partner_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  commission_count: number;
  version: number;
  approved_by: string | null;
  approved_at: number | null;
  failure_reason: string | null;
  created_at: number;
}

export interface AdminActionInput {
  d1: D1Database;
  payoutId: string;
  currentVersion: number;
  adminId: string;
  reason?: string;
}

export interface AdminActionResult {
  ok: boolean;
  conflict?: boolean;
  error?: string;
}

/**
 * Lists payouts awaiting an admin decision, newest first, ordered so the
 * largest claims are reviewed first.
 */
export async function listPendingApprovalPayouts(
  d1: D1Database,
  limit: number,
): Promise<PayoutListRow[]> {
  const result = await d1
    .prepare(
      `SELECT id, payout_reference, partner_id, amount_cents, currency, status,
              commission_count, version, approved_by, approved_at, failure_reason, created_at
       FROM affiliate_payouts
       WHERE status = 'pending_approval'
       ORDER BY amount_cents DESC, created_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<PayoutListRow>();

  return result.results ?? [];
}

/** Approves a payout, advancing its OCC version. */
export async function approvePayout(
  input: AdminActionInput,
): Promise<AdminActionResult> {
  const nowMs = Date.now();

  try {
    const res = await input.d1
      .prepare(
        `UPDATE affiliate_payouts
         SET status = 'approved',
             approved_by = ?1,
             approved_at = ?2,
             version = version + 1,
             updated_at = ?2
         WHERE id = ?3 AND version = ?4 AND status IN ('draft', 'pending_approval')`,
      )
      .bind(input.adminId, nowMs, input.payoutId, input.currentVersion)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      logger.warn('[admin/affiliate-payouts] Approve OCC conflict or already actioned', {
        payoutId: input.payoutId,
        currentVersion: input.currentVersion,
      });
      return { ok: false, conflict: true, error: 'OCC_VERSION_CONFLICT' };
    }

    return { ok: true };
  } catch (err) {
    logger.error('[admin/affiliate-payouts] Approve failed', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { ok: false, error: String(err) };
  }
}

/** Releases the commissions a payout reserved, so they can be claimed again. */
async function releaseReservedCommissions(
  d1: D1Database,
  payoutId: string,
): Promise<number> {
  const nowMs = Date.now();
  // Only rows this payout owns and that are still unpaid are released, so a
  // commission already settled by another payout can never be reopened.
  const res = await d1
    .prepare(
      `UPDATE affiliate_commissions
       SET payout_id = NULL,
           version = version + 1,
           updated_at = ?1
       WHERE payout_id = ?2 AND status = 'payable'`,
    )
    .bind(nowMs, payoutId)
    .run();

  return res.meta?.changes ?? 0;
}

/** Rejects a payout, stamping the mandatory reason and advancing OCC. */
export async function rejectPayout(
  input: AdminActionInput & { reason: string },
): Promise<AdminActionResult> {
  const nowMs = Date.now();

  try {
    const res = await input.d1
      .prepare(
        `UPDATE affiliate_payouts
         SET status = 'rejected',
             failure_reason = ?1,
             version = version + 1,
             updated_at = ?2
         WHERE id = ?3 AND version = ?4 AND status IN ('draft', 'pending_approval')`,
      )
      .bind(input.reason, nowMs, input.payoutId, input.currentVersion)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      logger.warn('[admin/affiliate-payouts] Reject OCC conflict or already actioned', {
        payoutId: input.payoutId,
        currentVersion: input.currentVersion,
      });
      return { ok: false, conflict: true, error: 'OCC_VERSION_CONFLICT' };
    }

    // A rejected payout still holds its commissions' payout_id, and every claim
    // path filters on `payout_id IS NULL`. Without releasing them here the
    // partner's earned money would be invisible to every sweep and the manual
    // request path for as long as the rejected row lives.
    const released = await releaseReservedCommissions(input.d1, input.payoutId);
    logger.info('[admin/affiliate-payouts] Rejected payout released commissions', {
      payoutId: input.payoutId,
      adminId: input.adminId,
      releasedCount: released,
    });

    return { ok: true };
  } catch (err) {
    logger.error('[admin/affiliate-payouts] Reject failed', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { ok: false, error: String(err) };
  }
}
