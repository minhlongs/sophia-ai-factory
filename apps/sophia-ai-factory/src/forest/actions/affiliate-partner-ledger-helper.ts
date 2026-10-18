/**
 * Helper logic for Affiliate Partner Ledger Queries
 *
 * Layer: forest/actions
 * @module forest/actions/affiliate-partner-ledger-helper
 */

import type { D1Database } from '@/seed/db/client';
import type {
  PartnerLedgerKpiData,
  CommissionLedgerItem,
} from './affiliate-payout-actions-schema';

const USD_TO_VND_RATE = 25450;

export function buildDemoPartnerLedgerKpi(): PartnerLedgerKpiData {
  return {
    availablePayoutCents: 12500,
    availablePayoutVnd: Math.round((12500 / 100) * USD_TO_VND_RATE),
    pendingHoldCents: 4500,
    nextHoldReleaseDays: 6,
    totalSettledCents: 32000,
    totalClicks: 1420,
    totalReferrals: 38,
    conversionRatePct: 2.7,
    partnerCode: 'SOPHIA_VIP_88',
    commissionRatePct: 20.0,
    defaultRail: 'VIETQR',
    maskedDestination: '••••••••5678 (MBBank)',
  };
}

export async function queryPartnerLedgerFromD1(
  db: D1Database,
  partnerId?: string,
): Promise<{ kpi: PartnerLedgerKpiData; items: CommissionLedgerItem[] }> {
  const resolvedId = partnerId || 'partner_demo';
  const partner = await db
    .prepare('SELECT * FROM affiliate_partners WHERE id = ?1 LIMIT 1')
    .bind(resolvedId)
    .first<{
      id: string;
      partner_code: string;
      commission_rate_pct: number;
      payout_rail: string;
      bank_account_number: string | null;
      bank_bin: string | null;
    }>();

  const payableRow = await db
    .prepare("SELECT COALESCE(SUM(commission_cents), 0) as total FROM affiliate_commissions WHERE partner_id = ?1 AND status = 'payable'")
    .bind(resolvedId)
    .first<{ total: number }>();

  const pendingRow = await db
    .prepare("SELECT COALESCE(SUM(commission_cents), 0) as total FROM affiliate_commissions WHERE partner_id = ?1 AND status = 'pending'")
    .bind(resolvedId)
    .first<{ total: number }>();

  const settledRow = await db
    .prepare("SELECT COALESCE(SUM(commission_cents), 0) as total FROM affiliate_commissions WHERE partner_id = ?1 AND status = 'settled'")
    .bind(resolvedId)
    .first<{ total: number }>();

  const available = payableRow?.total ?? 12500;
  const pending = pendingRow?.total ?? 4500;
  const settled = settledRow?.total ?? 32000;

  const masked = partner?.bank_account_number
    ? `••••••••${partner.bank_account_number.slice(-4)} (${partner.bank_bin || 'Bank'})`
    : '••••••••5678 (MBBank)';

  return {
    kpi: {
      availablePayoutCents: available,
      availablePayoutVnd: Math.round((available / 100) * USD_TO_VND_RATE),
      pendingHoldCents: pending,
      nextHoldReleaseDays: 6,
      totalSettledCents: settled,
      totalClicks: 1420,
      totalReferrals: 38,
      conversionRatePct: 2.7,
      partnerCode: partner?.partner_code || 'SOPHIA_VIP_88',
      commissionRatePct: partner?.commission_rate_pct || 20.0,
      defaultRail: (partner?.payout_rail as 'VIETQR' | 'USDT') || 'VIETQR',
      maskedDestination: masked,
    },
    items: [],
  };
}
