/**
 * SOP Marketplace Commission Split
 *
 * Creator earns 70%, platform keeps 30%.
 * Records to existing commission_ledger table with offer_id='sop_marketplace'.
 * 14-day payout hold covers refund window.
 */

const CREATOR_COMMISSION_PCT = 0.70;
const PAYOUT_DELAY_MS = 14 * 24 * 60 * 60 * 1000; // 14-day hold for refund window

export interface CommissionBreakdown {
  grossCents: number;
  creatorCents: number;
  platformCents: number;
  commissionPct: number;
}

export function calculateCreatorCommission(priceCents: number): CommissionBreakdown {
  if (priceCents < 0) throw new RangeError('priceCents must be non-negative');
  const creatorCents = Math.floor(priceCents * CREATOR_COMMISSION_PCT);
  const platformCents = priceCents - creatorCents;
  return {
    grossCents: priceCents,
    creatorCents,
    platformCents,
    commissionPct: CREATOR_COMMISSION_PCT,
  };
}

export interface RecordSaleInput {
  creatorId: string;
  listingId: string;
  templateId: string;
  licenseId: string;
  priceCents: number;
  paymentId: string;
  tenantId?: string;
}

/**
 * Inserts a commission_ledger row for a SOP marketplace sale.
 * Returns the generated ledger entry id.
 */
export async function recordSopSaleCommission(
  db: D1Database,
  input: RecordSaleInput,
): Promise<string> {
  if (!input.creatorId) throw new Error('creatorId is required');
  if (!input.licenseId) throw new Error('licenseId is required');
  if (input.priceCents < 0) throw new RangeError('priceCents must be non-negative');

  const { commissionPct, creatorCents } = calculateCreatorCommission(input.priceCents);
  const id = crypto.randomUUID();
  const now = Date.now();
  const payableAt = now + PAYOUT_DELAY_MS;

  const result = await db
    .prepare(
      `INSERT INTO commission_ledger (
        id, tenant_id, affiliate_id, conversion_event_id, offer_id,
        gross_cents, commission_pct, commission_cents, withheld_cents,
        status, payable_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, 'sop_marketplace', ?5, ?6, ?7, 0, 'pending', ?8, ?9, ?9)`,
    )
    .bind(
      id,
      input.tenantId ?? 'default',
      input.creatorId,
      input.licenseId,
      input.priceCents,
      commissionPct,
      creatorCents,
      payableAt,
      now,
    )
    .run();

  if (!result.success) {
    throw new Error(`Failed to insert commission_ledger row for licenseId=${input.licenseId}`);
  }

  return id;
}

export interface CreatorEarnings {
  totalEarned: number;
  pending: number;
  payable: number;
  paid: number;
}

/** Returns aggregated earnings by status for a SOP marketplace creator. */
export async function getCreatorEarnings(
  db: D1Database,
  creatorId: string,
): Promise<CreatorEarnings> {
  if (!creatorId) throw new Error('creatorId is required');

  const { results } = await db
    .prepare(
      `SELECT status, SUM(commission_cents) as total
       FROM commission_ledger
       WHERE affiliate_id = ?1 AND offer_id = 'sop_marketplace'
       GROUP BY status`,
    )
    .bind(creatorId)
    .all<{ status: string; total: number }>();

  let pending = 0;
  let payable = 0;
  let paid = 0;

  for (const r of results) {
    if (r.status === 'pending') pending = r.total ?? 0;
    else if (r.status === 'payable') payable = r.total ?? 0;
    else if (r.status === 'paid') paid = r.total ?? 0;
  }

  return { totalEarned: pending + payable + paid, pending, payable, paid };
}
