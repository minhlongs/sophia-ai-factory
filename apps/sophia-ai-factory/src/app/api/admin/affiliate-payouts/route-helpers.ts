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

    return { ok: true };
  } catch (err) {
    logger.error('[admin/affiliate-payouts] Reject failed', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { ok: false, error: String(err) };
  }
}
