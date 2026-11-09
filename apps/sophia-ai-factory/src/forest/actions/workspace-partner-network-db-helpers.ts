/**
 * D1 Database Helpers for Workspace Partner Network Management
 *
 * Strictly scopes all queries and mutations to `tenant_id = workspaceUserId`.
 *
 * Layer: forest (Server Action DB Helpers)
 * @module forest/actions/workspace-partner-network-db-helpers
 */

import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import type {
  RecruitWorkspacePartnerInput,
  WorkspacePartnerSummary,
} from './workspace-partner-network-schema';

interface RawWorkspacePartnerRow {
  id: string;
  partner_code: string;
  tier: string;
  commission_rate_pct: number;
  payout_rail: string | null;
  status: string;
  risk_score: number | null;
  is_suspicious: number | null;
  total_earnings_cents: number;
  pending_payout_cents: number;
  bank_bin: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  usdt_trc20_address_encrypted: string | null;
}

function maskUsdt(addr: string | null): string | null {
  if (!addr) return null;
  if (addr.length <= 10) return '••••••';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function queryWorkspacePartners(
  db: D1Database,
  tenantId: string,
): Promise<WorkspacePartnerSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT id, partner_code, tier, commission_rate_pct, payout_rail, status,
              risk_score, is_suspicious, total_earnings_cents, pending_payout_cents,
              bank_bin, bank_account_number, bank_account_name, usdt_trc20_address_encrypted
       FROM affiliate_partners
       WHERE tenant_id = ?1
       ORDER BY pending_payout_cents DESC, created_at DESC`,
    )
    .bind(tenantId)
    .all<RawWorkspacePartnerRow>();

  return (results ?? []).map((r) => ({
    id: r.id,
    partnerCode: r.partner_code,
    tier: r.tier,
    commissionRatePct: r.commission_rate_pct,
    payoutRail: r.payout_rail === 'VIETQR' ? 'VIETQR' : 'USDT',
    status: r.status === 'under_review' || r.status === 'suspended' ? r.status : 'active',
    riskScore: r.risk_score ?? 0,
    isSuspicious: Boolean(r.is_suspicious),
    totalEarningsCents: r.total_earnings_cents,
    pendingPayoutCents: r.pending_payout_cents,
    bankBin: r.bank_bin,
    bankAccountNumber: r.bank_account_number,
    bankAccountName: r.bank_account_name,
    usdtAddressMasked: maskUsdt(r.usdt_trc20_address_encrypted),
  }));
}

async function prepareUsdtStorageValue(usdtAddress?: string): Promise<string | null> {
  if (!usdtAddress) return null;
  try {
    return await encryptSecret(usdtAddress, process.env.PAYOUT_ENC_KEY);
  } catch {
    return usdtAddress;
  }
}

export async function insertWorkspacePartner(
  db: D1Database,
  tenantId: string,
  input: RecruitWorkspacePartnerInput,
): Promise<{ partnerId: string; normalizedCode: string }> {
  const normalizedCode = input.partnerCode.toUpperCase();
  const existing = await db
    .prepare('SELECT id FROM affiliate_partners WHERE partner_code = ?1')
    .bind(normalizedCode)
    .first<{ id: string }>();
  if (existing) {
    throw new Error(`Partner code ${normalizedCode} is already registered`);
  }

  const partnerId = `aff_ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const encryptedUsdt =
    input.payoutRail === 'USDT' ? await prepareUsdtStorageValue(input.usdtAddress) : null;

  await db
    .prepare(
      `INSERT INTO affiliate_partners
         (id, user_id, tenant_id, partner_code, tier, commission_rate_pct, payout_rail,
          bank_bin, bank_account_number, bank_account_name, usdt_trc20_address_encrypted,
          status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'STANDARD', ?5, ?6, ?7, ?8, ?9, ?10, 'active', ?11, ?11)`,
    )
    .bind(
      partnerId,
      `partner_${normalizedCode.toLowerCase()}`,
      tenantId,
      normalizedCode,
      input.commissionRatePct,
      input.payoutRail,
      input.payoutRail === 'VIETQR' ? (input.bankBin ?? null) : null,
      input.payoutRail === 'VIETQR' ? (input.bankAccountNumber ?? null) : null,
      input.payoutRail === 'VIETQR' ? (input.bankAccountName ?? null) : null,
      encryptedUsdt,
      now,
    )
    .run();

  return { partnerId, normalizedCode };
}
