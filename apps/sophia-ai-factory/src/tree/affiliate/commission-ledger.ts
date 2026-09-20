/**
 * Dual-Entry Commission Accounting Ledger & 14-Day Anti-Fraud Hold Engine
 *
 * Layer: tree (pure domain logic and transactional D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Guarantees:
 * 1. Double-Entry Immutability: Historical records are never mutated on clawbacks.
 *    Clawbacks are appended as explicit negative adjustment rows (parent_id linked).
 * 2. Deduplication & Idempotency: Enforced via UNIQUE(network, external_conversion_id)
 *    and unique clawback external ID suffixes.
 * 3. Exact 14-day hold math: payable_at = attributed_at + hold_days * 86,400,000 ms.
 *
 * @module tree/affiliate/commission-ledger
 */

export type CommissionLedgerStatus =
  | 'pending'
  | 'payable'
  | 'paying'
  | 'paid'
  | 'clawback'
  | 'clawed_back';

export type AffiliateNetwork =
  | 'tiktok_shop'
  | 'amazon_associates'
  | 'amazon'
  | 'clickbank'
  | 'accesstrade'
  | 'awin'
  | (string & {});

export interface CommissionEntryInput {
  id?: string;
  affiliateId: string;
  network: AffiliateNetwork;
  externalConversionId: string;
  subId?: string | null;
  orderValueCents: number;
  commissionCents: number;
  holdDays?: number; // defaults to 14
  attributedAt?: number; // defaults to Date.now()
  payableAt?: number; // defaults to attributedAt + holdDays * 86400000
}

export interface CommissionEntryResult {
  success: boolean;
  ledgerId: string;
  affiliateId: string;
  commissionCents: number;
  payableAt: number;
  network: string;
  duplicate?: boolean;
  error?: string;
}

export interface ClawbackAdjustmentInput {
  parentConversionId: string;
  refundCents: number;
  reason?: string;
  nowMs?: number;
}

export interface LedgerAdjustmentResult {
  success: boolean;
  adjustmentId?: string;
  amountCents: number; // negative value (-refundCents)
  status: 'clawback' | 'clawed_back';
  parentConversionId: string;
  error?: string;
}

export interface NetBalanceResult {
  affiliateId: string;
  totalCommissionsCents: number;
  totalClawbacksCents: number;
  netCents: number;
  pendingCents: number;
  payableCents: number;
  paidCents: number;
}

/**
 * Calculates exact millisecond timestamp when 14-day anti-fraud hold matures.
 */
export function calculatePayableAt(attributedAtMs: number, holdDays = 14): number {
  return attributedAtMs + holdDays * 86400 * 1000;
}

/**
 * Inserts a positive commission credit row into commission_ledger with status = 'pending'.
 * Idempotent: checks for existing network + external_conversion_id.
 */
export async function recordCommissionEntry(
  db: D1Database,
  input: CommissionEntryInput,
  nowMs = Date.now(),
): Promise<CommissionEntryResult> {
  const holdDays = input.holdDays ?? 14;
  const attributedAt = input.attributedAt ?? nowMs;
  const payableAt = input.payableAt ?? calculatePayableAt(attributedAt, holdDays);
  const ledgerId = input.id ?? `com_${input.externalConversionId}`;

  // 1. Idempotency pre-check
  try {
    const existing = await db
      .prepare(
        `SELECT id, affiliate_id, commission_cents, payable_at, network
         FROM commission_ledger
         WHERE network = ? AND external_conversion_id = ?
         LIMIT 1`,
      )
      .bind(input.network, input.externalConversionId)
      .first<{
        id: string;
        affiliate_id: string;
        commission_cents: number;
        payable_at: number;
        network: string;
      }>();

    if (existing) {
      return {
        success: true,
        duplicate: true,
        ledgerId: existing.id,
        affiliateId: existing.affiliate_id,
        commissionCents: existing.commission_cents,
        payableAt: existing.payable_at,
        network: existing.network,
      };
    }
  } catch {
    // If pre-check fails (e.g. table not initialized yet), proceed to insert
  }

  // 2. Insert pending credit row
  try {
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, sub_id,
          order_value_cents, commission_cents, status, hold_days,
          attributed_at, payable_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .bind(
        ledgerId,
        input.affiliateId,
        input.network,
        input.externalConversionId,
        input.subId ?? null,
        input.orderValueCents,
        input.commissionCents,
        holdDays,
        attributedAt,
        payableAt,
        nowMs,
      )
      .run();

    return {
      success: true,
      ledgerId,
      affiliateId: input.affiliateId,
      commissionCents: input.commissionCents,
      payableAt,
      network: input.network,
    };
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes('UNIQUE constraint failed') || errStr.includes('constraint')) {
      return {
        success: true,
        duplicate: true,
        ledgerId,
        affiliateId: input.affiliateId,
        commissionCents: input.commissionCents,
        payableAt,
        network: input.network,
      };
    }
    return {
      success: false,
      ledgerId,
      affiliateId: input.affiliateId,
      commissionCents: input.commissionCents,
      payableAt,
      network: input.network,
      error: errStr,
    };
  }
}

/**
 * Appends a negative adjustment row for clawbacks/refunds.
 * Dual-entry invariant: NEVER mutates historical commission rows.
 * Formats external_conversion_id as claw_${parentConversionId}_${adjustmentSuffix}
 * to prevent index collision on multiple partial refunds.
 */
export async function recordClawbackAdjustment(
  db: D1Database,
  parentConversionId: string,
  refundCents: number,
  nowMs = Date.now(),
  _reason?: string,
): Promise<LedgerAdjustmentResult> {
  // 1. Locate original commission row by external_conversion_id or id
  const original = await db
    .prepare(
      `SELECT id, affiliate_id, network, external_conversion_id, commission_cents, status
       FROM commission_ledger
       WHERE external_conversion_id = ? OR id = ?
       LIMIT 1`,
    )
    .bind(parentConversionId, parentConversionId)
    .first<{
      id: string;
      affiliate_id: string;
      network: string;
      external_conversion_id: string;
      commission_cents: number;
      status: string;
    }>();

  if (!original) {
    return {
      success: false,
      amountCents: 0,
      status: 'clawback',
      parentConversionId,
      error: 'CONVERSION_NOT_FOUND',
    };
  }

  // 2. Compute negative adjustment amount (-|refundCents|)
  const negativeCents = -Math.abs(refundCents);
  const randSuffix = Math.random().toString(36).substring(2, 9);
  const adjustmentId = `adj_${randSuffix}_${nowMs}`;
  const clawbackExternalId = `claw_${parentConversionId}_${randSuffix}`;

  // 3. Append negative adjustment row
  await db
    .prepare(
      `INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id,
        commission_cents, status, hold_days, attributed_at, payable_at, parent_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'clawback', 0, ?, ?, ?, ?)`,
    )
    .bind(
      adjustmentId,
      original.affiliate_id,
      original.network,
      clawbackExternalId,
      negativeCents,
      nowMs,
      nowMs,
      original.id,
      nowMs,
    )
    .run();

  return {
    success: true,
    adjustmentId,
    amountCents: negativeCents,
    status: 'clawback',
    parentConversionId,
  };
}

/**
 * Promotes all mature pending rows to payable status.
 * Evaluates: status = 'pending' AND payable_at <= nowTimestampMs
 *
 * @param db D1 database instance
 * @param nowTimestampMs Millisecond timestamp (defaults to Date.now())
 * @returns Number of rows promoted
 */
export async function flipPendingToPayable(
  db: D1Database,
  nowTimestampMs = Date.now(),
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'payable'
       WHERE status = 'pending' AND payable_at <= ?`,
    )
    .bind(nowTimestampMs)
    .run();

  return result.meta?.changes ?? 0;
}

/**
 * Computes the net balance in cents for a given affiliate across all ledger rows.
 * Because clawbacks are stored as negative numbers, SUM(commission_cents) is exact.
 */
export async function getNetAffiliateBalance(
  db: D1Database,
  affiliateId: string,
): Promise<number> {
  const res = await db
    .prepare(
      `SELECT SUM(commission_cents) AS net_cents
       FROM commission_ledger
       WHERE affiliate_id = ?`,
    )
    .bind(affiliateId)
    .first<{ net_cents: number | null }>();

  return res?.net_cents ?? 0;
}

/**
 * Computes an itemized breakdown of affiliate earnings by status.
 */
export async function getAffiliateBalanceBreakdown(
  db: D1Database,
  affiliateId: string,
): Promise<NetBalanceResult> {
  const rows = await db
    .prepare(
      `SELECT status, SUM(commission_cents) AS sum_cents
       FROM commission_ledger
       WHERE affiliate_id = ?
       GROUP BY status`,
    )
    .bind(affiliateId)
    .all<{ status: string; sum_cents: number }>();

  let totalCommissionsCents = 0;
  let totalClawbacksCents = 0;
  let pendingCents = 0;
  let payableCents = 0;
  let paidCents = 0;

  for (const r of rows.results ?? []) {
    const amount = r.sum_cents ?? 0;
    if (r.status === 'clawback' || r.status === 'clawed_back') {
      totalClawbacksCents += Math.abs(amount);
    } else {
      totalCommissionsCents += amount;
      if (r.status === 'pending') pendingCents += amount;
      else if (r.status === 'payable') payableCents += amount;
      else if (r.status === 'paid') paidCents += amount;
    }
  }

  const netCents = totalCommissionsCents - totalClawbacksCents;

  return {
    affiliateId,
    totalCommissionsCents,
    totalClawbacksCents,
    netCents,
    pendingCents,
    payableCents,
    paidCents,
  };
}
