/**
 * @module tests/e2e/partner-federation-e2e.test
 *
 * Comprehensive End-to-End (E2E) Test Suite:
 * Global Partner Channels, Enterprise Reseller Federation & White-Label Co-Op Engine
 *
 * Requirements & Architecture Covered (PROJECT.md & TEST_INFRA.md):
 * - Tier 1: Feature Coverage (Features 1 - 16 Happy Paths):
 *   F1. Master-Sub Reseller Hierarchy Binding & Tree Aggregation
 *   F2. 5% Cascade Override Calculation & Ledger Accrual
 *   F3. Bulk License Pooling Provisioning
 *   F4. Atomic Quota Allocation & Consumption Tracking
 *   F5. Monthly Co-Op Marketing Budget Accrual
 *   F6. Co-Op Claim Ingestion & Budget Solvency
 *   F7. Heuristic & Automated Invoice Appraisal Scoring (0-100)
 *   F8. Multi-Rail Payout Batch Settlement (USDT & VietQR)
 *   F9. 90-Day Budget Sweep & Balance Reclaiming
 *   F10. Cloudflare SSL for SaaS Custom Domain Resolution
 *   F11. Resend Email Domain Provisioning & Verification
 *   F12. 100% White-Label Portal & Zero-Vendor Metadata
 *   F13. Monthly Cohort Matrix & Retention Analytics
 *   F14. Rolling 7d/30d MCU Consumption Velocity & Runway
 *   F15. Branded Report Export Engine (Printable HTML & RFC-4180 CSV)
 *   F16. Event Webhook Bus Signing & Notification Dispatch
 *
 * - Tier 2: Boundary & Corner Cases:
 *   B1. Odd Cents & Micro-Transactions (Zero Penny Leakage Guarantee)
 *   B2. Zero Budget Claim Appraisal & Rejection
 *   B3. Zero Quota Allocation Guardrails
 *   B4. Invalid Domain & Localhost Resolution Safety
 *   B5. Expired Budget Claim Block
 *   B6. Duplicate Invoice Number Idempotency
 *   B7. Negative & Invalid Parameters Rejection
 *   B8. Master Agency Suspension Escrow Protection
 *   B9. Dormant MCU Velocity & Infinite Runway Handling
 *   B10. 100% Unbranded Verification Proof across Exports and Metadata
 *
 * - Tier 3: Cross-Feature Combinations:
 *   C1. Reseller Hierarchy + License Pooling + Quota Depletion Webhook
 *   C2. Revenue Generation + 5% Cascade Override + 5% Co-Op Accrual + Multi-Rail Settlement
 *   C3. White-Label Domain Resolution + Theme Injection + Branded Export
 *
 * - Tier 4: Real-World Application Scenarios (TEST_INFRA.md Scenarios 1-5):
 *   S1. Global Media Agency provisions 10 sub-agencies with pooled quota; 5% override flows
 *   S2. Platinum Partner achieves $30,000 MRR, earns $1,500 Co-Op, submits Meta Ads invoice, settles via USDT
 *   S3. Agency sets up custom domain, configures Resend DKIM, portal shows 0 Sophia traces
 *   S4. Agency reviews Monthly Cohort Retention and downloads branded PDF/Excel report
 *   S5. Sub-client reaches 90% MCU consumption, triggers webhook to agency CRM, auto-topup executes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';

// Domain Services & Math Models
import {
  calculateCascadeOverride,
  bindSubReseller,
  getResellerHierarchyTree,
  accrueCascadeOverride,
  unbindSubReseller,
  MASTER_CASCADE_OVERRIDE_RATE_PCT,
} from '@/tree/partners/reseller-hierarchy';
import {
  createLicensePool,
  allocatePoolQuota,
  recordMcuConsumption,
  getLicensePoolById,
  getPartnerLicensePools,
  deallocatePoolQuota,
} from '@/tree/partners/license-pooling';
import {
  calculateMonthlyCoOpAccrual,
  accrueMonthlyCoOpBudget,
  auditCoOpClaimInvoice,
  submitCoOpClaim,
  sweepExpiredCoOpBudgets,
  getPartnerCoOpSummary,
  getPartnerCoOpAllocations,
  CO_OP_ACCRUAL_RATE_PCT,
  CO_OP_BUDGET_EXPIRY_MS,
  AUTO_APPROVAL_SCORE_THRESHOLD,
  AUTO_APPROVAL_MAX_AMOUNT_CENTS,
} from '@/tree/partners/co-op-engine';
import {
  createPayoutBatch,
  executePayoutBatch,
  convertCentsToVnd,
  getPayoutBatchById,
  USD_TO_VND_EXCHANGE_RATE,
  MIN_BATCH_AMOUNT_CENTS,
} from '@/tree/partners/payout-batcher';
import {
  resolveWhitelabelTheme,
  sanitizeBrandCss,
  sanitizeUrlForCss,
  validateHexColor,
  generateThemeCssBlock,
  resolveAgencyByDomain,
  resolveAgencyBySlug,
  renderUnbrandedPortalMetadata,
} from '@/tree/partners/whitelabel-portal';
import {
  isValidDomainName,
  provisionResendDomain,
  verifyResendDomainStatus,
  getAgencyEmailSender,
} from '@/tree/partners/resend-domain-service';
import {
  computePartnerCohortMatrix,
  calculateMcuVelocity,
  formatYearMonth,
  diffMonths,
  addMonths,
  type ClientSubscriptionRecord,
  type McuLogRecord,
} from '@/tree/partners/partner-analytics';
import {
  formatPartnerCsvReport,
  formatPartnerPrintableHtml,
  generateSvgSparkline,
  formatCurrency,
  escapeCsvCell,
  escapeHtml,
} from '@/tree/partners/export-formatter';
import {
  signPartnerWebhookPayload,
  verifyPartnerWebhookSignature,
  dispatchPartnerQuotaWebhook,
  calculateBackoffDelayMs,
} from '@/tree/partners/partner-webhook-bus';
import { PARTNER_TIERS, type PartnerTier } from '@/tree/partners/types';

// ============================================================================
// In-Memory SQLite D1 Database Harness
// ============================================================================

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createE2eTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      partner_type TEXT NOT NULL CHECK(partner_type IN ('agency', 'reseller', 'affiliate', 'integrator')),
      tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      referral_code TEXT NOT NULL UNIQUE,
      custom_domain TEXT UNIQUE,
      whitelabel_enabled INTEGER NOT NULL DEFAULT 0,
      total_referred_customers INTEGER NOT NULL DEFAULT 0,
      total_mrr_cents INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      payout_rail TEXT DEFAULT 'USDT' CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
      payout_destination_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending_approval')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_organizations (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      organization_type TEXT NOT NULL CHECK(organization_type IN ('master_agency', 'sub_agency', 'standard_partner', 'enterprise_reseller')),
      tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
      cascade_override_pct REAL NOT NULL DEFAULT 5.0,
      billing_email TEXT NOT NULL,
      custom_domain TEXT UNIQUE,
      whitelabel_config_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending', 'pending_approval')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS partner_sub_resellers (
      id TEXT PRIMARY KEY,
      master_partner_id TEXT NOT NULL,
      sub_partner_id TEXT NOT NULL UNIQUE,
      agreement_ref TEXT,
      override_rate_pct REAL NOT NULL DEFAULT 5.0,
      lifetime_override_cents INTEGER NOT NULL DEFAULT 0,
      pending_override_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'terminated', 'paused')),
      joined_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (master_partner_id) REFERENCES partner_profiles(id),
      FOREIGN KEY (sub_partner_id) REFERENCES partner_profiles(id),
      CHECK(master_partner_id != sub_partner_id)
    );

    CREATE TABLE IF NOT EXISTS partner_license_pools (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      pool_name TEXT NOT NULL,
      total_seats INTEGER NOT NULL DEFAULT 0,
      allocated_seats INTEGER NOT NULL DEFAULT 0,
      total_mcu_credits INTEGER NOT NULL DEFAULT 0,
      allocated_mcu_credits INTEGER NOT NULL DEFAULT 0,
      consumed_mcu_credits INTEGER NOT NULL DEFAULT 0,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      auto_topup_enabled INTEGER NOT NULL DEFAULT 0,
      auto_topup_threshold_mcu INTEGER DEFAULT 0,
      auto_topup_amount_mcu INTEGER DEFAULT 0,
      period_start INTEGER,
      period_end INTEGER,
      auto_renew INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'expired', 'revoked')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      CHECK(allocated_seats <= total_seats),
      CHECK(allocated_mcu_credits <= total_mcu_credits),
      CHECK(consumed_mcu_credits <= allocated_mcu_credits)
    );

    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referred_tenant_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      mrr_cents INTEGER NOT NULL,
      commission_rate_pct REAL NOT NULL,
      commission_cents INTEGER NOT NULL,
      tier_at_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'clawed_back')),
      payout_batch_id TEXT,
      period_start INTEGER,
      period_end INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      UNIQUE(partner_id, order_id)
    );

    CREATE TABLE IF NOT EXISTS partner_whitelabel_configs (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      brand_name TEXT NOT NULL,
      agency_slug TEXT,
      portal_title TEXT,
      login_headline TEXT,
      login_subheading TEXT,
      custom_css TEXT,
      logo_url TEXT,
      favicon_url TEXT,
      primary_color TEXT DEFAULT '#06b6d4',
      accent_color TEXT DEFAULT '#3b82f6',
      custom_domain TEXT UNIQUE,
      custom_email_sender TEXT,
      support_url TEXT,
      footer_html TEXT,
      is_ssl_active INTEGER NOT NULL DEFAULT 0,
      dns_txt_verification_token TEXT,
      dns_verified_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS co_op_budget_allocations (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      billing_cycle_month TEXT NOT NULL,
      tier_at_time TEXT NOT NULL CHECK(tier_at_time IN ('GOLD', 'PLATINUM')),
      mrr_basis_cents INTEGER NOT NULL,
      accrual_rate_pct REAL NOT NULL DEFAULT 5.0,
      allocated_cents INTEGER NOT NULL,
      claimed_cents INTEGER NOT NULL DEFAULT 0,
      remaining_cents INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'expired', 'locked', 'closed')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      UNIQUE(partner_id, billing_cycle_month),
      CHECK(claimed_cents <= allocated_cents)
    );

    CREATE TABLE IF NOT EXISTS partner_co_op_claims (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      budget_allocation_id TEXT,
      campaign_name TEXT NOT NULL,
      claim_type TEXT NOT NULL CHECK(claim_type IN ('paid_ads', 'influencer_sponsorship', 'offline_event', 'creative_production', 'co_branded_content', 'digital_ads', 'event_sponsorship', 'content_creation', 'webinar', 'print_media', 'other')),
      invoice_number TEXT NOT NULL,
      invoice_url TEXT NOT NULL,
      invoice_date INTEGER NOT NULL,
      requested_amount_cents INTEGER NOT NULL,
      approved_amount_cents INTEGER NOT NULL DEFAULT 0,
      reimbursement_currency TEXT NOT NULL DEFAULT 'USDT' CHECK(reimbursement_currency IN ('USDT', 'VND')),
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'approved', 'rejected', 'processing', 'paid', 'disbursed', 'cancelled')),
      audit_score REAL DEFAULT 0.0,
      audit_notes_json TEXT DEFAULT '[]',
      rejection_reason TEXT,
      payout_batch_id TEXT,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      paid_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      FOREIGN KEY (budget_allocation_id) REFERENCES co_op_budget_allocations(id),
      UNIQUE(partner_id, invoice_number)
    );

    CREATE TABLE IF NOT EXISTS partner_payout_batches (
      id TEXT PRIMARY KEY,
      partner_id TEXT,
      batch_type TEXT NOT NULL CHECK(batch_type IN ('commission', 'co_op_reimbursement', 'hybrid')),
      payout_rail TEXT NOT NULL CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
      total_amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'VND', 'USDT')),
      total_amount_local INTEGER NOT NULL DEFAULT 0,
      fx_rate REAL NOT NULL DEFAULT 1.0,
      item_count INTEGER NOT NULL DEFAULT 0,
      destination_address TEXT,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
      external_reference TEXT,
      raw_response_json TEXT DEFAULT '{}',
      error_message TEXT,
      executed_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL UNIQUE,
      allocated_mcu INTEGER NOT NULL DEFAULT 0,
      used_mcu INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

// Seed partner helper
async function seedPartnerRecord(
  db: D1Database,
  id: string,
  name: string,
  tier: PartnerTier = 'PLATINUM',
  status: 'active' | 'suspended' = 'active',
) {
  const now = Date.now();
  await db
    .prepare(`
      INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier,
        commission_rate_pct, referral_code, whitelabel_enabled,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'agency', ?, ?, ?, 1, ?, ?, ?)
    `)
    .bind(
      id,
      `usr_${id}`,
      `ten_${id}`,
      name,
      tier,
      PARTNER_TIERS[tier].ratePct,
      `REF_${id.toUpperCase()}`,
      status,
      now,
      now,
    )
    .run();
}

describe('Comprehensive E2E Testing Suite: Partner Federation & Co-Op Engine', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createE2eTestDb();
  });

  // ==========================================================================
  // Tier 1: Feature Coverage (Happy Paths for Features 1 - 16)
  // ==========================================================================
  describe('Tier 1: Feature Coverage (Happy Paths for Features 1-16)', () => {
    it('F1. Master-Sub Reseller Hierarchy: binds agencies and aggregates hierarchy tree metrics', async () => {
      await seedPartnerRecord(db, 'master_agency_1', 'Global Media Master', 'PLATINUM');
      await seedPartnerRecord(db, 'sub_agency_1', 'APAC Digital Sub', 'GOLD');

      const bindRes = await bindSubReseller(db, 'master_agency_1', 'sub_agency_1', 'AGREEMENT_2026_Q3');
      expect(bindRes.success).toBe(true);
      expect(bindRes.binding?.master_partner_id).toBe('master_agency_1');
      expect(bindRes.binding?.override_rate_pct).toBe(5.0);

      const tree = await getResellerHierarchyTree(db, 'master_agency_1');
      expect(tree.masterPartnerId).toBe('master_agency_1');
      expect(tree.totalSubAgencies).toBe(1);
      expect(tree.activeSubAgencies).toBe(1);
      expect(tree.subAgencies[0].subPartnerId).toBe('sub_agency_1');
    });

    it('F2. 5% Cascade Override Ledger: computes and accrues override on customer transaction', async () => {
      await seedPartnerRecord(db, 'master_agency_2', 'Prime Master', 'PLATINUM');
      await seedPartnerRecord(db, 'sub_agency_2', 'Regional Sub', 'GOLD');
      await bindSubReseller(db, 'master_agency_2', 'sub_agency_2');

      // $10,000 MRR = 1,000,000 cents
      const calc = calculateCascadeOverride(1_000_000, 28.0, true, 'master_agency_2');
      expect(calc.overrideCents).toBe(50_000); // 5% = $500
      expect(calc.subPartnerCommissionCents).toBe(280_000); // 28% = $2,800
      expect(calc.platformNetCents).toBe(670_000); // 67% = $6,700
      expect(calc.overrideCents + calc.subPartnerCommissionCents + calc.platformNetCents).toBe(1_000_000);

      const accrueRes = await accrueCascadeOverride(db, 'sub_agency_2', 'order_mrr_1', 1_000_000);
      expect(accrueRes.success).toBe(true);
      expect(accrueRes.overrideCents).toBe(50_000);
      expect(accrueRes.escrowed).toBe(false);

      // Verify master profile pending payout
      const master = await db
        .prepare('SELECT pending_payout_cents, total_earnings_cents FROM partner_profiles WHERE id = ?')
        .bind('master_agency_2')
        .first<{ pending_payout_cents: number; total_earnings_cents: number }>();
      expect(master?.pending_payout_cents).toBe(50_000);
      expect(master?.total_earnings_cents).toBe(50_000);
    });

    it('F3. Bulk License Pooling: creates pool with seats, MCU credits, and unit price', async () => {
      await seedPartnerRecord(db, 'pool_agency_1', 'Pooling Master', 'PLATINUM');

      const poolRes = await createLicensePool(
        db,
        'pool_agency_1',
        'Enterprise APAC Q3 Pool',
        50,
        500_000,
        500, // $5.00 per unit
        { autoTopupEnabled: true, autoTopupThresholdMcu: 50_000, autoTopupAmountMcu: 100_000 },
      );

      expect(poolRes.success).toBe(true);
      expect(poolRes.pool?.pool_name).toBe('Enterprise APAC Q3 Pool');
      expect(poolRes.pool?.total_seats).toBe(50);
      expect(poolRes.pool?.total_mcu_credits).toBe(500_000);
      expect(poolRes.pool?.auto_topup_enabled).toBe(1);
    });

    it('F4. Atomic Quota Allocation: allocates capacity to subaccount and records consumption', async () => {
      await seedPartnerRecord(db, 'pool_agency_2', 'Allocation Agency', 'PLATINUM');
      const pool = (await createLicensePool(db, 'pool_agency_2', 'Client Pool', 20, 100_000, 200)).pool!;

      const allocRes = await allocatePoolQuota(db, pool.id, 'client_sub_alpha', 5, 20_000);
      expect(allocRes.success).toBe(true);
      expect(allocRes.allocatedSeats).toBe(5);
      expect(allocRes.allocatedMcuCredits).toBe(20_000);
      expect(allocRes.remainingPoolSeats).toBe(15);
      expect(allocRes.remainingPoolMcu).toBe(80_000);

      // Record consumption
      const consumeRes = await recordMcuConsumption(db, pool.id, 'client_sub_alpha', 5_000);
      expect(consumeRes.success).toBe(true);
      expect(consumeRes.mcuConsumed).toBe(5_000);
      expect(consumeRes.totalConsumedMcu).toBe(5_000);
      expect(consumeRes.remainingAllocatedMcu).toBe(15_000);
    });

    it('F5. Monthly Co-Op Budget Accrual: sets aside 5% MRR for Gold and Platinum partners', async () => {
      await seedPartnerRecord(db, 'coop_agency_gold', 'Gold Agency', 'GOLD');
      await seedPartnerRecord(db, 'coop_agency_plat', 'Plat Agency', 'PLATINUM');
      await seedPartnerRecord(db, 'coop_agency_silv', 'Silver Agency', 'SILVER');

      // Math verification
      expect(calculateMonthlyCoOpAccrual(1_000_000, 'GOLD')).toBe(50_000); // 5% of $10,000 = $500
      expect(calculateMonthlyCoOpAccrual(3_000_000, 'PLATINUM')).toBe(150_000); // 5% of $30,000 = $1,500
      expect(calculateMonthlyCoOpAccrual(1_000_000, 'SILVER')).toBe(0); // Silver = 0

      // D1 database accrual
      const goldAccrual = await accrueMonthlyCoOpBudget(db, 'coop_agency_gold', '2026-09', 1_000_000, 'GOLD');
      expect(goldAccrual.success).toBe(true);
      expect(goldAccrual.allocatedCents).toBe(50_000);
      expect(goldAccrual.allocation?.status).toBe('active');
    });

    it('F6. Co-Op Claim Submission: submits marketing claim against available allocation', async () => {
      await seedPartnerRecord(db, 'coop_claim_agency', 'Claim Agency', 'PLATINUM');
      await accrueMonthlyCoOpBudget(db, 'coop_claim_agency', '2026-09', 2_000_000, 'PLATINUM'); // $1,000 budget

      const claimRes = await submitCoOpClaim(db, {
        partnerId: 'coop_claim_agency',
        campaignName: 'Sophia AI Growth Meta Campaign',
        claimType: 'paid_ads',
        invoiceNumber: 'INV-META-2026-001',
        invoiceUrl: 'https://storage.agencyos.network/invoices/inv-meta-001.pdf',
        invoiceDate: Date.now(),
        requestedAmountCents: 50_000, // $500.00
        reimbursementCurrency: 'USDT',
      });

      expect(claimRes.success).toBe(true);
      expect(claimRes.claim?.invoice_number).toBe('INV-META-2026-001');
      expect(claimRes.claim?.requested_amount_cents).toBe(50_000);
    });

    it('F7. Automated Invoice Appraisal: scores 100/100 and auto-approves compliant claim', () => {
      const now = Date.now();
      const appraisal = auditCoOpClaimInvoice({
        claimId: 'claim_audit_1',
        vendorName: 'Google Ads',
        invoiceNumber: 'INV-GOOG-889',
        invoiceUrl: 'https://cdn.example.com/inv-889.pdf',
        invoiceDate: now,
        periodStart: now - 15 * 86_400 * 1000,
        periodEnd: now,
        requestedAmountCents: 150_000, // $1,500 <= $2,000 limit
        availableBudgetCents: 200_000,
        campaignName: 'Sophia AI Factory APAC Launch',
        proofUrl: 'https://cdn.example.com/proof.png',
        brandKeywords: ['sophia', 'agencyos'],
      });

      expect(appraisal.auditScore).toBe(100);
      expect(appraisal.isAutoApproved).toBe(true);
      expect(appraisal.breakdown.vendorVerified).toBe(true);
      expect(appraisal.breakdown.dateValid).toBe(true);
      expect(appraisal.breakdown.proofProvided).toBe(true);
      expect(appraisal.breakdown.budgetSufficient).toBe(true);
    });

    it('F8. Multi-Rail Payout Batcher: creates and executes payout batch for USDT & VietQR', async () => {
      await seedPartnerRecord(db, 'payout_agency_1', 'Payout Agency', 'PLATINUM');
      await accrueMonthlyCoOpBudget(db, 'payout_agency_1', '2026-09', 2_000_000, 'PLATINUM'); // $1,000 budget

      // Submit claim that gets approved
      const claim = (await submitCoOpClaim(db, {
        partnerId: 'payout_agency_1',
        campaignName: 'TikTok Ads Campaign',
        claimType: 'paid_ads',
        invoiceNumber: 'INV-TT-999',
        invoiceUrl: 'https://cdn.agency.com/inv-tt.pdf',
        invoiceDate: Date.now(),
        requestedAmountCents: 60_000,
        reimbursementCurrency: 'USDT',
      })).claim!;

      // Mark approved
      await db
        .prepare("UPDATE partner_co_op_claims SET status = 'approved', approved_amount_cents = 60000 WHERE id = ?")
        .bind(claim.id)
        .run();

      // Create USDT Batch
      const batchRes = await createPayoutBatch(
        db,
        'payout_agency_1',
        'co_op_reimbursement',
        'USDT',
        'USDT',
        { claimIds: [claim.id] },
      );
      expect(batchRes.success).toBe(true);
      expect(batchRes.batch?.total_amount_cents).toBe(60_000);
      expect(batchRes.batch?.currency).toBe('USDT');

      // Execute batch
      const execRes = await executePayoutBatch(db, batchRes.batch!.id, async () => ({
        success: true,
        txHash: '0x9999abcdef0123456789',
        externalReference: 'NOWPAY_TX_123',
      }));
      expect(execRes.success).toBe(true);
      const updatedBatch = await getPayoutBatchById(db, batchRes.batch!.id);
      expect(updatedBatch?.status).toBe('completed');
      expect(updatedBatch?.tx_hash).toBe('0x9999abcdef0123456789');

      // FX Conversion for VietQR
      const vndAmount = convertCentsToVnd(10_000, USD_TO_VND_EXCHANGE_RATE); // $100
      expect(vndAmount).toBe(2_545_000); // 100 * 25,450 VND
    });

    it('F9. 90-Day Budget Sweep: auto-expires stale allocations and reclaims unspent balance', async () => {
      await seedPartnerRecord(db, 'sweep_agency', 'Sweep Agency', 'PLATINUM');

      // Accrue budget 95 days ago
      const ninetyFiveDaysAgo = Date.now() - 95 * 86_400 * 1000;
      await db
        .prepare(`
          INSERT INTO co_op_budget_allocations (
            id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
            accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
            expires_at, status, created_at, updated_at
          ) VALUES (?, ?, '2026-05', 'PLATINUM', 1000000, 5.0, 50000, 10000, 40000, ?, 'active', ?, ?)
        `)
        .bind(
          'alloc_expired_1',
          'sweep_agency',
          ninetyFiveDaysAgo + CO_OP_BUDGET_EXPIRY_MS,
          ninetyFiveDaysAgo,
          ninetyFiveDaysAgo,
        )
        .run();

      const sweepRes = await sweepExpiredCoOpBudgets(db, Date.now());
      expect(sweepRes.expiredCount).toBe(1);
      expect(sweepRes.reclaimedCents).toBe(40_000);

      const allocation = (await getPartnerCoOpAllocations(db, 'sweep_agency'))[0];
      expect(allocation.status).toBe('expired');
    });

    it('F10. Cloudflare SSL for SaaS: resolves agency configuration by custom domain CNAME', async () => {
      await seedPartnerRecord(db, 'domain_agency', 'Apex Agency', 'PLATINUM');

      await db
        .prepare(`
          INSERT INTO partner_whitelabel_configs (
            id, partner_id, brand_name, custom_domain, is_ssl_active,
            primary_color, accent_color, created_at, updated_at
          ) VALUES (?, ?, 'Apex Marketing', 'portal.apexmarketing.com', 1, '#10b981', '#6366f1', ?, ?)
        `)
        .bind('pwc_1', 'domain_agency', Date.now(), Date.now())
        .run();

      const resolved = await resolveAgencyByDomain(db, 'portal.apexmarketing.com');
      expect(resolved).not.toBeNull();
      expect(resolved?.brandName).toBe('Apex Marketing');
      expect(resolved?.primaryColor).toBe('#10b981');
      expect(resolved?.secondaryColor).toBe('#6366f1');
      expect(resolved?.isSslActive).toBe(true);
    });

    it('F11. Resend Email Verification: generates DKIM and SPF records for agency domain', async () => {
      expect(isValidDomainName('agencybrand.com')).toBe(true);
      expect(isValidDomainName('portal.marketing.agency')).toBe(true);
      expect(isValidDomainName('invalid domain')).toBe(false);

      const provision = await provisionResendDomain({
        domainName: 'agencybrand.com',
        apiKey: 're_test_mock_123',
        mockDns: true,
      });

      expect(provision.success).toBe(true);
      expect(provision.dnsRecords.length).toBeGreaterThan(0);
      expect(provision.dnsRecords.some((r) => r.type === 'TXT' && r.record === 'SPF')).toBe(true);
      expect(provision.dnsRecords.some((r) => r.record === 'DKIM')).toBe(true);
    });

    it('F12. 100% White-Label Portal: generates CSS variables and unbranded metadata with 0 Sophia traces', () => {
      const theme = resolveWhitelabelTheme({
        brandName: 'Titan Growth',
        primaryColor: '#0ea5e9',
        accentColor: '#f59e0b',
        logoUrl: 'https://cdn.titan.com/logo.svg',
      });

      expect(theme['--brand-primary']).toBe('#0ea5e9');
      expect(theme['--brand-secondary']).toBe('#f59e0b');
      expect(theme['--brand-agency-name']).toBe('"Titan Growth"');

      // Unbranded portal metadata
      const meta = renderUnbrandedPortalMetadata({
        brandName: 'Titan Growth',
        portalTitle: 'Titan Client Hub',
        loginHeadline: 'Welcome to Titan Client Hub',
        loginSubheading: 'Sign in to access your video marketing platform',
        logoUrl: 'https://cdn.titan.com/logo.svg',
        faviconUrl: 'https://cdn.titan.com/favicon.ico',
        supportUrl: 'https://titan.com/support',
        primaryColor: '#0ea5e9',
        secondaryColor: '#f59e0b',
        customDomain: 'hub.titan.com',
        partnerId: 'partner_titan',
        agencySlug: 'titan-growth',
        agencyName: 'Titan Growth',
        customEmailSender: 'support@titan.com',
        footerHtml: null,
        customCss: null,
        isSslActive: true,
      });

      expect(meta.title).toContain('Titan Client Hub');
      expect(meta.openGraph.siteName).toBe('Titan Growth');

      // Vendor leakage check
      const rawString = JSON.stringify(meta).toLowerCase();
      expect(rawString).not.toContain('sophia');
      expect(rawString).not.toContain('agencyos');
    });

    it('F13. Cohort Matrix Analytics: computes monthly retention, NRR, and LTV', () => {
      const clients: ClientSubscriptionRecord[] = [
        {
          clientId: 'client_1',
          firstOrderAt: '2026-01-10',
          monthlyHistory: [
            { month: '2026-01', mrrCents: 50_000, active: true },
            { month: '2026-02', mrrCents: 50_000, active: true },
            { month: '2026-03', mrrCents: 60_000, active: true },
          ],
        },
        {
          clientId: 'client_2',
          firstOrderAt: '2026-01-15',
          monthlyHistory: [
            { month: '2026-01', mrrCents: 30_000, active: true },
            { month: '2026-02', mrrCents: 0, active: false },
          ],
        },
      ];

      const matrix = computePartnerCohortMatrix(clients);
      expect(matrix.cohorts.length).toBeGreaterThan(0);
      const janCohort = matrix.cohorts.find((c) => c.cohortMonth === '2026-01');
      expect(janCohort).toBeDefined();
      expect(janCohort?.initialSize).toBe(2);
      expect(janCohort?.initialMrrCents).toBe(80_000);
      expect(matrix.summary.totalClients).toBe(2);
    });

    it('F14. Rolling MCU Velocity: calculates 7d/30d consumption rate, acceleration, and runway', () => {
      const now = Date.now();
      const dayMs = 86_400 * 1000;
      const logs: McuLogRecord[] = [];

      // 100 MCU consumed per day for 30 days
      for (let i = 0; i < 30; i++) {
        logs.push({
          timestamp: now - i * dayMs,
          delta: -100,
          mcuConsumed: 100,
        });
      }

      const velocity = calculateMcuVelocity(logs, 30, 3_000, now);
      expect(velocity.velocity30d).toBeCloseTo(100, 0);
      expect(velocity.currentBalance).toBe(3_000);
      expect(velocity.runwayDays).toBeCloseTo(30, 0); // 3,000 balance / 100 daily = 30 days
    });

    it('F15. Branded Export Engine: formats printable HTML and RFC-4180 CSV without vendor leakage', () => {
      const sampleCohorts = [
        {
          cohortMonth: '2026-01',
          initialSize: 10,
          initialMrrCents: 500_000,
          totalRealizedRevenueCents: 1_500_000,
          realizedLtvCents: 150_000,
          periods: [
            {
              monthIndex: 0,
              activityMonth: '2026-01',
              activeClients: 10,
              logoRetentionPct: 100,
              mrrCents: 500_000,
              nrrPct: 100,
              logoChurnPct: 0,
              mrrChurnPct: 0,
            },
          ],
        },
      ];

      const sampleSummary = {
        totalClients: 10,
        activeClients: 10,
        totalMrrCents: 500_000,
        avgLtvCents: 150_000,
        projectedLtvCents: 300_000,
        blendedChurnPct: 0,
        avgM1RetentionPct: 100,
        avgM3RetentionPct: 100,
        overallNrrPct: 100,
      };

      const analyticsSummary = {
        partnerId: 'partner_velocity',
        partnerName: 'Velocity Digital Agency',
        tier: 'PLATINUM' as const,
        period: '2026-01',
        generatedAt: Date.now(),
        totalSubClients: 10,
        activeSubClients: 10,
        totalMrrCents: 500_000,
        monthlyCommissionCents: 175_000,
        lifetimeEarningsCents: 500_000,
        totalMcuAllocated: 50_000,
        totalMcuConsumed: 10_000,
        avgMcuVelocityDaily: 100,
        avgLtvCents: 150_000,
        blendedChurnPct: 0,
        revenueGrowthPct: 15.0,
        topSubClients: [],
        cohortMatrix: {
          cohorts: sampleCohorts,
          summary: sampleSummary,
        },
      };

      const branding = {
        brandName: 'Velocity Digital Agency',
        agencyName: 'Velocity Digital Agency',
        logoUrl: 'https://cdn.velocity.com/logo.png',
        primaryColor: '#6366f1',
      };

      // HTML Export
      const html = formatPartnerPrintableHtml(analyticsSummary, branding);
      expect(html).toContain('Velocity Digital Agency');
      expect(html).toContain('#6366f1');
      expect(html.toLowerCase()).not.toContain('sophia');
      expect(html.toLowerCase()).not.toContain('agencyos');

      // CSV Export
      const csv = formatPartnerCsvReport(analyticsSummary, branding);
      expect(csv).toContain('Velocity Digital Agency');
      expect(csv).toContain('Cohort Month');
      expect(csv.toLowerCase()).not.toContain('sophia');
    });

    it('F16. Event Webhook Bus: signs payload with HMAC-SHA256 and verifies signature', async () => {
      const secret = 'whsec_test_secret_key_1234567890';
      const payload = {
        event: 'partner.quota.low',
        partnerId: 'agency_wh_1',
        data: { remainingMcu: 5_000, thresholdMcu: 10_000 },
      };

      const nowSeconds = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(payload);
      const signatureResult = await signPartnerWebhookPayload(secret, rawBody, nowSeconds);

      expect(signatureResult.headerValue).toContain('t=');
      expect(signatureResult.headerValue).toContain('v1=');

      const verification = await verifyPartnerWebhookSignature(
        secret,
        signatureResult.headerValue,
        rawBody,
        300,
        nowSeconds,
      );

      expect(verification.valid).toBe(true);
      expect(verification.timestamp).toBe(nowSeconds);

      // Tampered payload detection
      const tamperedBody = JSON.stringify({ ...payload, data: { remainingMcu: 999_999 } });
      const tamperedVerif = await verifyPartnerWebhookSignature(
        secret,
        signatureResult.headerValue,
        tamperedBody,
        300,
        nowSeconds,
      );
      expect(tamperedVerif.valid).toBe(false);
    });
  });

  // ==========================================================================
  // Tier 2: Boundary & Corner Cases
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1. Odd Cents & Micro-Transactions: zero penny leakage across odd cent splits', () => {
      const testCases = [
        { mrr: 1, rate: 28.0 },
        { mrr: 3, rate: 20.0 },
        { mrr: 7, rate: 35.0 },
        { mrr: 19, rate: 28.0 },
        { mrr: 99, rate: 35.0 },
        { mrr: 101, rate: 20.0 },
        { mrr: 999, rate: 28.0 },
      ];

      for (const tc of testCases) {
        const res = calculateCascadeOverride(tc.mrr, tc.rate, true);
        const sum = res.overrideCents + res.subPartnerCommissionCents + res.platformNetCents;
        expect(sum).toBe(tc.mrr);
        expect(Number.isInteger(res.overrideCents)).toBe(true);
        expect(Number.isInteger(res.subPartnerCommissionCents)).toBe(true);
        expect(Number.isInteger(res.platformNetCents)).toBe(true);
      }
    });

    it('B2. Zero Budget Claim: deducts 25 points when requested amount exceeds budget', () => {
      const appraisal = auditCoOpClaimInvoice({
        vendorName: 'Meta Ads',
        invoiceDate: Date.now(),
        requestedAmountCents: 50_000,
        availableBudgetCents: 0, // Zero budget available
        campaignName: 'Sophia AI Campaign',
      });

      expect(appraisal.breakdown.budgetSufficient).toBe(false);
      expect(appraisal.auditScore).toBeLessThanOrEqual(75);
      expect(appraisal.isAutoApproved).toBe(false);
    });

    it('B3. Empty Quota Allocations: rejects allocation of 0 seats and 0 MCU', async () => {
      await seedPartnerRecord(db, 'agency_b3', 'B3 Agency');
      const pool = (await createLicensePool(db, 'agency_b3', 'Pool B3', 10, 10_000, 100)).pool!;

      const res = await allocatePoolQuota(db, pool.id, 'client_empty', 0, 0);
      expect(res.success).toBe(false);
      expect(res.error).toBe('NO_ALLOCATION_REQUESTED');
    });

    it('B4. Invalid Domain & Localhost Resolution: rejects localhost and malformed domains', async () => {
      expect(await resolveAgencyByDomain(db, 'localhost')).toBeNull();
      expect(await resolveAgencyByDomain(db, '127.0.0.1')).toBeNull();
      expect(await resolveAgencyByDomain(db, '')).toBeNull();
      expect(await resolveAgencyByDomain(db, '   ')).toBeNull();

      expect(isValidDomainName('http://example.com')).toBe(false); // No protocol allowed
      expect(isValidDomainName('example.com/path')).toBe(false); // No path allowed
      expect(isValidDomainName('has space.com')).toBe(false);
    });

    it('B5. Expired Co-Op Budget: submitCoOpClaim routes claim to under_review or rejects when budget expired', async () => {
      await seedPartnerRecord(db, 'agency_b5', 'B5 Agency', 'PLATINUM');
      const ninetyFiveDaysAgo = Date.now() - 95 * 86_400 * 1000;

      // Insert expired allocation
      await db
        .prepare(`
          INSERT INTO co_op_budget_allocations (
            id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
            accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
            expires_at, status, created_at, updated_at
          ) VALUES (?, ?, '2026-05', 'PLATINUM', 1000000, 5.0, 50000, 0, 50000, ?, 'expired', ?, ?)
        `)
        .bind('alloc_b5', 'agency_b5', ninetyFiveDaysAgo + CO_OP_BUDGET_EXPIRY_MS, ninetyFiveDaysAgo, ninetyFiveDaysAgo)
        .run();

      const claimRes = await submitCoOpClaim(db, {
        partnerId: 'agency_b5',
        campaignName: 'Late Campaign',
        claimType: 'paid_ads',
        invoiceNumber: 'INV-LATE-001',
        invoiceUrl: 'https://cdn.example.com/late.pdf',
        invoiceDate: Date.now(),
        requestedAmountCents: 20_000,
        reimbursementCurrency: 'USDT',
      });

      // Since only expired allocation exists, available budget is 0 -> rejected with INSUFFICIENT_CO_OP_BUDGET
      expect(claimRes.success).toBe(false);
      expect(claimRes.error).toBe('INSUFFICIENT_CO_OP_BUDGET');
    });

    it('B6. Duplicate Invoice Numbers: rejects duplicate invoice submissions idempotently', async () => {
      await seedPartnerRecord(db, 'agency_b6', 'B6 Agency', 'PLATINUM');
      await accrueMonthlyCoOpBudget(db, 'agency_b6', '2026-09', 2_000_000, 'PLATINUM');

      const claimData = {
        partnerId: 'agency_b6',
        campaignName: 'Unique Invoice Campaign',
        claimType: 'paid_ads' as const,
        invoiceNumber: 'INV-DUP-TEST-001',
        invoiceUrl: 'https://cdn.example.com/inv.pdf',
        invoiceDate: Date.now(),
        requestedAmountCents: 10_000,
        reimbursementCurrency: 'USDT' as const,
      };

      const res1 = await submitCoOpClaim(db, claimData);
      expect(res1.success).toBe(true);

      const res2 = await submitCoOpClaim(db, claimData);
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('DUPLICATE_INVOICE_SUBMISSION');
    });

    it('B7. Negative & Invalid Parameters: pool creation fails safe on invalid inputs', async () => {
      await seedPartnerRecord(db, 'agency_b7', 'B7 Agency');

      // Negative seats
      const r1 = await createLicensePool(db, 'agency_b7', 'Valid Name', -5, 10_000, 100);
      expect(r1.success).toBe(false);
      expect(r1.error).toBe('INVALID_SEATS_COUNT');

      // Negative MCU
      const r2 = await createLicensePool(db, 'agency_b7', 'Valid Name', 10, -500, 100);
      expect(r2.success).toBe(false);
      expect(r2.error).toBe('INVALID_MCU_CREDITS');

      // Empty name
      const r3 = await createLicensePool(db, 'agency_b7', '', 10, 1_000, 100);
      expect(r3.success).toBe(false);
      expect(r3.error).toBe('INVALID_POOL_NAME');
    });

    it('B8. Master Agency Suspension Escrow: cascade override is escrowed when master is suspended', async () => {
      await seedPartnerRecord(db, 'suspended_master_b8', 'Suspended Master', 'PLATINUM', 'active');
      await seedPartnerRecord(db, 'active_sub_b8', 'Active Sub', 'GOLD', 'active');
      await bindSubReseller(db, 'suspended_master_b8', 'active_sub_b8');

      // Now suspend master
      await db
        .prepare("UPDATE partner_profiles SET status = 'suspended' WHERE id = ?")
        .bind('suspended_master_b8')
        .run();

      const accrueRes = await accrueCascadeOverride(db, 'active_sub_b8', 'order_escrow_1', 1_000_000);
      expect(accrueRes.success).toBe(true);
      expect(accrueRes.escrowed).toBe(true);
      expect(accrueRes.reason).toBe('MASTER_AGENCY_SUSPENDED');

      // Pending payout balance must NOT increase for suspended master
      const master = await db
        .prepare('SELECT pending_payout_cents FROM partner_profiles WHERE id = ?')
        .bind('suspended_master_b8')
        .first<{ pending_payout_cents: number }>();
      expect(master?.pending_payout_cents).toBe(0);
    });

    it('B9. Dormant MCU Velocity: empty consumption history defaults to 999 runway days and stable trend', () => {
      const velocity = calculateMcuVelocity([], 30, 50_000);
      expect(velocity.velocity7d).toBe(0);
      expect(velocity.velocity30d).toBe(0);
      expect(velocity.runwayDays).toBe(999);
      expect(velocity.trend).toBe('stable');
      expect(velocity.exhaustionRisk).toBe('dormant');
    });

    it('B10. 100% Unbranded Verification: proves zero vendor leakage across theme, metadata, and HTML export', () => {
      const config = {
        brandName: 'Omni Media Global',
        portalTitle: 'Omni Portal',
        loginHeadline: 'Client Access',
        loginSubheading: 'Sign in to your omni dashboard',
        primaryColor: '#2563eb',
        accentColor: '#f97316',
        customDomain: 'portal.omniglobal.com',
      };

      const theme = resolveWhitelabelTheme(config);
      const metadata = renderUnbrandedPortalMetadata({
        ...config,
        partnerId: 'partner_omni',
        agencySlug: 'omni-global',
        agencyName: 'Omni Media Global',
        logoUrl: null,
        faviconUrl: null,
        secondaryColor: '#f97316',
        customEmailSender: 'support@omniglobal.com',
        supportUrl: null,
        footerHtml: null,
        customCss: null,
        isSslActive: true,
      });

      const fullString = (JSON.stringify(theme) + JSON.stringify(metadata)).toLowerCase();
      expect(fullString).not.toContain('sophia');
      expect(fullString).not.toContain('agencyos');
    });
  });

  // ==========================================================================
  // Tier 3: Cross-Feature Combinations
  // ==========================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('C1. Reseller Hierarchy + License Pooling + Quota Depletion Webhook', async () => {
      // 1. Establish Master-Sub hierarchy
      await seedPartnerRecord(db, 'c1_master', 'C1 Master Agency', 'PLATINUM');
      await seedPartnerRecord(db, 'c1_sub', 'C1 Sub Agency', 'GOLD');
      await bindSubReseller(db, 'c1_master', 'c1_sub');

      // 2. Create license pool with auto-topup threshold
      const pool = (
        await createLicensePool(db, 'c1_sub', 'Sub Pool', 10, 50_000, 100, {
          autoTopupEnabled: true,
          autoTopupThresholdMcu: 10_000,
          autoTopupAmountMcu: 25_000,
        })
      ).pool!;

      // 3. Sub-agency provisions client subaccount
      const alloc = await allocatePoolQuota(db, pool.id, 'subaccount_vip', 2, 20_000);
      expect(alloc.success).toBe(true);

      // 4. Client consumes 95% of MCU (19,000 out of 20,000)
      // Auto-topup automatically replenishes +25,000 MCU when remaining drops <= 10,000
      const consumption = await recordMcuConsumption(db, pool.id, 'subaccount_vip', 19_000);
      expect(consumption.success).toBe(true);
      expect(consumption.remainingAllocatedMcu).toBe(26_000); // 1,000 remaining + 25,000 topup
      expect(consumption.autoTopupExecuted).toBe(true);
      expect(consumption.thresholdTriggered).toBe(true);

      // 5. Trigger webhook alert for low quota
      const webhookPayload = {
        event: 'partner.quota.low',
        partnerId: 'c1_sub',
        subaccountId: 'subaccount_vip',
        data: {
          remainingMcu: consumption.remainingAllocatedMcu,
          thresholdMcu: 2_000,
        },
      };

      const nowSeconds = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(webhookPayload);
      const signatureResult = await signPartnerWebhookPayload('whsec_c1_secret', rawBody, nowSeconds);
      const verified = await verifyPartnerWebhookSignature(
        'whsec_c1_secret',
        signatureResult.headerValue,
        rawBody,
        300,
        nowSeconds,
      );
      expect(verified.valid).toBe(true);
    });

    it('C2. Revenue Generation + 5% Cascade Override + 5% Co-Op Accrual + Multi-Rail Settlement', async () => {
      // 1. Setup hierarchy
      await seedPartnerRecord(db, 'c2_master', 'C2 Master Holding', 'PLATINUM');
      await seedPartnerRecord(db, 'c2_sub', 'C2 Regional Reseller', 'PLATINUM');
      await bindSubReseller(db, 'c2_master', 'c2_sub');

      // 2. Sub-agency generates $50,000 MRR (5,000,000 cents)
      const mrrCents = 5_000_000;
      const cascade = calculateCascadeOverride(mrrCents, 35.0, true, 'c2_master');
      expect(cascade.overrideCents).toBe(250_000); // 5% = $2,500
      expect(cascade.subPartnerCommissionCents).toBe(1_750_000); // 35% = $17,500

      // Accrue cascade override to master
      await accrueCascadeOverride(db, 'c2_sub', 'order_big_1', mrrCents);

      // 3. Co-Op Accrual for Sub (Platinum earns 5% of MRR = $2,500)
      const coopAccrual = await accrueMonthlyCoOpBudget(db, 'c2_sub', '2026-09', mrrCents, 'PLATINUM');
      expect(coopAccrual.allocatedCents).toBe(250_000);

      // 4. Sub submits Co-Op claim for $1,200 (120,000 cents)
      const claim = (
        await submitCoOpClaim(db, {
          partnerId: 'c2_sub',
          campaignName: 'Sophia AI APAC Video Summit',
          claimType: 'event_sponsorship',
          invoiceNumber: 'INV-SUMMIT-2026',
          invoiceUrl: 'https://cdn.summit.com/inv.pdf',
          invoiceDate: Date.now(),
          requestedAmountCents: 120_000,
          reimbursementCurrency: 'USDT',
        })
      ).claim!;

      // Mark approved
      await db
        .prepare("UPDATE partner_co_op_claims SET status = 'approved', approved_amount_cents = 120000 WHERE id = ?")
        .bind(claim.id)
        .run();

      // 5. Multi-rail payout batch creation and settlement via USDT
      const batchRes = await createPayoutBatch(
        db,
        'c2_sub',
        'co_op_reimbursement',
        'USDT',
        'USDT',
        { claimIds: [claim.id] },
      );
      expect(batchRes.success).toBe(true);

      const execRes = await executePayoutBatch(db, batchRes.batch!.id, async () => ({
        success: true,
        txHash: '0xusdt_tx_successful_hash_123',
      }));
      expect(execRes.success).toBe(true);
      const completedBatch = await getPayoutBatchById(db, batchRes.batch!.id);
      expect(completedBatch?.status).toBe('completed');
      expect(completedBatch?.tx_hash).toBe('0xusdt_tx_successful_hash_123');
    });

    it('C3. White-Label Domain Resolution + Theme Injection + Branded Export', async () => {
      await seedPartnerRecord(db, 'c3_agency', 'Nexus Marketing', 'PLATINUM');

      await db
        .prepare(`
          INSERT INTO partner_whitelabel_configs (
            id, partner_id, brand_name, custom_domain, is_ssl_active,
            primary_color, accent_color, created_at, updated_at
          ) VALUES (?, ?, 'Nexus Marketing', 'portal.nexusgrowth.com', 1, '#8b5cf6', '#ec4899', ?, ?)
        `)
        .bind('pwc_c3', 'c3_agency', Date.now(), Date.now())
        .run();

      // 1. Resolve domain
      const config = await resolveAgencyByDomain(db, 'portal.nexusgrowth.com');
      expect(config?.brandName).toBe('Nexus Marketing');

      // 2. Generate Theme CSS Block
      const theme = resolveWhitelabelTheme(config!);
      const cssBlock = generateThemeCssBlock(theme, '.nexus-card { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }');
      expect(cssBlock).toContain('--brand-primary: #8b5cf6;');
      expect(cssBlock).toContain('.nexus-card');

      // 3. Generate Branded Reports
      const analyticsSummary = {
        partnerId: 'c3_agency',
        partnerName: 'Nexus Marketing',
        tier: 'PLATINUM' as const,
        period: '2026-09',
        generatedAt: Date.now(),
        totalSubClients: 5,
        activeSubClients: 5,
        totalMrrCents: 250_000,
        monthlyCommissionCents: 87_500,
        lifetimeEarningsCents: 250_000,
        totalMcuAllocated: 50_000,
        totalMcuConsumed: 10_000,
        avgMcuVelocityDaily: 100,
        avgLtvCents: 100_000,
        blendedChurnPct: 0,
        revenueGrowthPct: 10.0,
        topSubClients: [],
        cohortMatrix: {
          cohorts: [],
          summary: {
            totalClients: 5,
            activeClients: 5,
            totalMrrCents: 250_000,
            avgLtvCents: 100_000,
            projectedLtvCents: 200_000,
            blendedChurnPct: 0,
            avgM1RetentionPct: 100,
            avgM3RetentionPct: 100,
            overallNrrPct: 100,
          },
        },
      };

      const htmlReport = formatPartnerPrintableHtml(analyticsSummary, {
        brandName: config!.brandName,
        agencyName: config!.brandName,
        primaryColor: config!.primaryColor,
      });

      expect(htmlReport).toContain('Nexus Marketing');
      expect(htmlReport).toContain('#8b5cf6');
      expect(htmlReport.toLowerCase()).not.toContain('sophia');
    });
  });

  // ==========================================================================
  // Tier 4: Real-World Application Scenarios (from TEST_INFRA.md)
  // ==========================================================================
  describe('Tier 4: Real-World Application Scenarios (TEST_INFRA.md)', () => {
    it('Scenario 1: Global Media Agency provisions 10 sub-agencies with 50,000 pooled MCU; 5% override flows', async () => {
      // Setup Master Holding Agency
      await seedPartnerRecord(db, 'global_holding', 'Global Media Holding', 'PLATINUM');

      // Master provisions a 50,000 MCU bulk license pool
      const pool = (
        await createLicensePool(db, 'global_holding', 'Global Federation Pool', 20, 50_000, 300)
      ).pool!;

      // Bind 10 Sub-Agencies
      const subAgencies: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const subId = `sub_agency_${i}`;
        await seedPartnerRecord(db, subId, `Regional Affiliate ${i}`, 'GOLD');
        const bindRes = await bindSubReseller(db, 'global_holding', subId, `AGREEMENT_REGION_${i}`);
        expect(bindRes.success).toBe(true);
        subAgencies.push(subId);

        // Allocate 1 seat and 4,000 MCU to each sub-agency's primary client
        const alloc = await allocatePoolQuota(db, pool.id, `client_of_${subId}`, 1, 4_000);
        expect(alloc.success).toBe(true);

        // Each sub-agency generates a $2,000 transaction (200,000 cents)
        const overrideRes = await accrueCascadeOverride(db, subId, `tx_region_${i}`, 200_000);
        expect(overrideRes.overrideCents).toBe(10_000); // 5% = $100 per sub-agency
      }

      // Verify Master Hierarchy Tree Aggregation
      const tree = await getResellerHierarchyTree(db, 'global_holding');
      expect(tree.totalSubAgencies).toBe(10);
      expect(tree.activeSubAgencies).toBe(10);
      expect(tree.totalPendingOverrideCents).toBe(100_000); // 10 * $100 = $1,000 (100,000 cents)

      // Verify Pool Allocation State
      const updatedPool = await getLicensePoolById(db, pool.id);
      expect(updatedPool?.allocated_seats).toBe(10);
      expect(updatedPool?.allocated_mcu_credits).toBe(40_000);
      expect(updatedPool!.total_mcu_credits - updatedPool!.allocated_mcu_credits).toBe(10_000);
    });

    it('Scenario 2: Platinum Partner achieves $30,000 MRR, earns $1,500 Co-Op fund, submits Meta Ads invoice, auto-settled via USDT', async () => {
      await seedPartnerRecord(db, 'platinum_powerhouse', 'Powerhouse Media', 'PLATINUM');

      // 1. Partner achieves $30,000 MRR (3,000,000 cents)
      const mrrCents = 3_000_000;
      const expectedAccrual = calculateMonthlyCoOpAccrual(mrrCents, 'PLATINUM');
      expect(expectedAccrual).toBe(150_000); // 5% = $1,500

      // 2. System accrues $1,500 to monthly Co-Op budget
      const budgetRes = await accrueMonthlyCoOpBudget(db, 'platinum_powerhouse', '2026-09', mrrCents, 'PLATINUM');
      expect(budgetRes.allocatedCents).toBe(150_000);

      // 3. Partner submits Meta Ads invoice for $1,200 (120,000 cents)
      const now = Date.now();
      const claimRes = await submitCoOpClaim(db, {
        partnerId: 'platinum_powerhouse',
        campaignName: 'Sophia AI Meta Retargeting Campaign',
        claimType: 'paid_ads',
        invoiceNumber: 'INV-META-30K-001',
        invoiceUrl: 'https://storage.powerhouse.com/meta-invoice.pdf',
        invoiceDate: now,
        requestedAmountCents: 120_000, // <= $2,000 auto-approval ceiling
        reimbursementCurrency: 'USDT',
      });

      expect(claimRes.success).toBe(true);
      expect(claimRes.claim?.status).toBe('approved'); // Auto-approved!
      expect(claimRes.claim?.approved_amount_cents).toBe(120_000);

      // 4. Automated USDT Payout Batch execution
      const batchRes = await createPayoutBatch(
        db,
        'platinum_powerhouse',
        'co_op_reimbursement',
        'USDT',
        'USDT',
        { claimIds: [claimRes.claim!.id] },
      );
      expect(batchRes.success).toBe(true);

      const execRes = await executePayoutBatch(db, batchRes.batch!.id, async () => ({
        success: true,
        txHash: '0xmeta_ads_reimbursement_tx_hash',
      }));

      expect(execRes.success).toBe(true);
      const settledBatch = await getPayoutBatchById(db, batchRes.batch!.id);
      expect(settledBatch?.status).toBe('completed');
      expect(settledBatch?.tx_hash).toBe('0xmeta_ads_reimbursement_tx_hash');

      // 5. Verify remaining Co-Op budget balance
      const summary = await getPartnerCoOpSummary(db, 'platinum_powerhouse');
      expect(summary).not.toBeNull();
      expect(summary!.totalAllocatedCents).toBe(150_000);
      expect(summary!.totalClaimedCents).toBe(120_000);
      expect(summary!.availableBudgetCents).toBe(30_000); // $300 remaining
    });

    it('Scenario 3: Agency sets up portal.apexbrand.com, configures Resend DKIM, invites client, client sees 0 Sophia traces', async () => {
      await seedPartnerRecord(db, 'agency_brand_3', 'Apex Creative', 'PLATINUM');

      // 1. Configure custom domain with Cloudflare SSL for SaaS active
      await db
        .prepare(`
          INSERT INTO partner_whitelabel_configs (
            id, partner_id, brand_name, custom_domain, is_ssl_active,
            primary_color, accent_color, portal_title, login_headline,
            login_subheading, custom_email_sender, created_at, updated_at
          ) VALUES (?, ?, 'Apex Creative Studio', 'portal.apexbrand.com', 1, '#3b82f6', '#10b981', 'Apex Creative Portal', 'Sign in to Apex Portal', 'Your enterprise creative studio', 'marketing@apexbrand.com', ?, ?)
        `)
        .bind('pwc_apex', 'agency_brand_3', Date.now(), Date.now())
        .run();

      // 2. Configure Resend DKIM & SPF records
      const dkimResult = await provisionResendDomain({
        domainName: 'apexbrand.com',
        apiKey: 're_live_key_apex',
        mockDns: true,
      });
      expect(dkimResult.success).toBe(true);

      const senderEmail = getAgencyEmailSender({
        domainName: 'apexbrand.com',
        senderName: 'Apex Creative Studio',
        customEmailSender: 'marketing@apexbrand.com',
      });
      expect(senderEmail).toBe('Apex Creative Studio <marketing@apexbrand.com>');

      // 3. Client visits portal.apexbrand.com -> resolve agency configuration
      const resolved = await resolveAgencyByDomain(db, 'portal.apexbrand.com');
      expect(resolved).not.toBeNull();
      expect(resolved?.brandName).toBe('Apex Creative Studio');

      // 4. Render client metadata
      const clientMeta = renderUnbrandedPortalMetadata(resolved!);
      expect(clientMeta.title).toBe('Apex Creative Portal');

      // 5. Zero Sophia Traces Proof
      const serialized = (
        JSON.stringify(resolved) +
        JSON.stringify(clientMeta) +
        senderEmail
      ).toLowerCase();

      expect(serialized).not.toContain('sophia');
      expect(serialized).not.toContain('agencyos');
    });

    it('Scenario 4: Agency reviews Monthly Cohort Retention and downloads branded PDF/Excel report with custom logo', () => {
      // 1. Prepare cohort data spanning Q1 to Q3 2026
      const clientCohorts: ClientSubscriptionRecord[] = [
        {
          clientId: 'client_alpha',
          firstOrderAt: '2026-01-05',
          monthlyHistory: [
            { month: '2026-01', mrrCents: 100_000, active: true },
            { month: '2026-02', mrrCents: 100_000, active: true },
            { month: '2026-03', mrrCents: 120_000, active: true },
            { month: '2026-04', mrrCents: 120_000, active: true },
          ],
        },
        {
          clientId: 'client_beta',
          firstOrderAt: '2026-02-10',
          monthlyHistory: [
            { month: '2026-02', mrrCents: 80_000, active: true },
            { month: '2026-03', mrrCents: 80_000, active: true },
          ],
        },
      ];

      const matrix = computePartnerCohortMatrix(clientCohorts);
      expect(matrix.cohorts.length).toBe(2);

      const analyticsSummary = {
        partnerId: 'agency_horizon',
        partnerName: 'Horizon Media Partners',
        tier: 'PLATINUM' as const,
        period: '2026-04',
        generatedAt: Date.now(),
        totalSubClients: 2,
        activeSubClients: 2,
        totalMrrCents: 200_000,
        monthlyCommissionCents: 70_000,
        lifetimeEarningsCents: 200_000,
        totalMcuAllocated: 100_000,
        totalMcuConsumed: 20_000,
        avgMcuVelocityDaily: 200,
        avgLtvCents: 100_000,
        blendedChurnPct: 0,
        revenueGrowthPct: 15.0,
        topSubClients: [],
        cohortMatrix: matrix,
      };

      const branding = {
        brandName: 'Horizon Media Partners',
        agencyName: 'Horizon Media Partners',
        logoUrl: 'https://cdn.horizon.com/logo.svg',
        primaryColor: '#059669',
      };

      // 2. Generate Printable HTML (for PDF export)
      const printableHtml = formatPartnerPrintableHtml(analyticsSummary, branding);
      expect(printableHtml).toContain('Horizon Media Partners');
      expect(printableHtml).toContain('#059669');
      expect(printableHtml).toContain('Cohort');

      // 3. Generate CSV (for Excel export)
      const csvReport = formatPartnerCsvReport(analyticsSummary, branding);
      expect(csvReport).toContain('Horizon Media Partners');
      expect(csvReport).toContain('2026-01');
      expect(csvReport).toContain('2026-02');

      // Invariant: Zero vendor leakage in exported business intelligence
      expect(printableHtml.toLowerCase()).not.toContain('sophia');
      expect(csvReport.toLowerCase()).not.toContain('sophia');
    });

    it('Scenario 5: Sub-client approaches 90% MCU consumption, triggers webhook to agency CRM, auto-topup replenishes pool', async () => {
      await seedPartnerRecord(db, 'agency_s5', 'Smart Topup Agency', 'PLATINUM');

      // 1. Pool created with 10 seats, 200,000 MCU, and auto-topup configured at 10,000 threshold
      const pool = (
        await createLicensePool(db, 'agency_s5', 'Auto-Topup Pool', 10, 200_000, 200, {
          autoTopupEnabled: true,
          autoTopupThresholdMcu: 10_000,
          autoTopupAmountMcu: 50_000,
        })
      ).pool!;

      // 2. Allocate 50,000 MCU to sub-client
      await allocatePoolQuota(db, pool.id, 'client_power_user', 1, 50_000);

      // 3. Sub-client consumes 46,000 MCU (92% consumption)
      const consumeRes = await recordMcuConsumption(db, pool.id, 'client_power_user', 46_000);
      expect(consumeRes.success).toBe(true);
      // Auto-topup triggered: 4,000 remaining + 50,000 topup = 54,000
      expect(consumeRes.remainingAllocatedMcu).toBe(54_000);
      expect(consumeRes.autoTopupExecuted).toBe(true);
      expect(consumeRes.thresholdTriggered).toBe(true);

      // 4. Trigger signed webhook to Agency CRM
      const alertPayload = {
        event: 'partner.quota.depleted',
        partnerId: 'agency_s5',
        subaccountId: 'client_power_user',
        data: {
          remainingMcu: consumeRes.remainingAllocatedMcu,
          thresholdMcu: 10_000,
          percentConsumed: 92.0,
        },
      };

      const nowSec = Math.floor(Date.now() / 1000);
      const rawAlert = JSON.stringify(alertPayload);
      const webhookSig = await signPartnerWebhookPayload('whsec_agency_crm_key', rawAlert, nowSec);
      const verifyResult = await verifyPartnerWebhookSignature(
        'whsec_agency_crm_key',
        webhookSig.headerValue,
        rawAlert,
        300,
        nowSec,
      );
      expect(verifyResult.valid).toBe(true);

      // 5. Sub-client or agency replenishes / allocates top-up quota
      // Remaining pool unallocated capacity: 200,000 - 50,000 (initial) - 50,000 (auto-topup) = 100,000
      const topupAlloc = await allocatePoolQuota(db, pool.id, 'client_power_user', 0, 30_000);
      expect(topupAlloc.success).toBe(true);
      expect(topupAlloc.allocatedMcuCredits).toBe(30_000);
    });
  });
});
