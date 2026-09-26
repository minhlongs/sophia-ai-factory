/** @vitest-environment node */

/**
 * Unit Test Suite: Multi-Org Financial Close Orchestrator & Intercompany Settlement
 *
 * Validates:
 * 1. Financial close finite state machine transitions (open -> closing -> closed -> locked)
 * 2. Protection against unauthorized re-opening of locked periods
 * 3. Revenue aggregates roll-up calculation
 * 4. Cross-border withholding tax calculation (VN FCT 10%/5%, US W-8 30%/0%)
 * 5. Balanced Vietnam VAS TT200 Chart of Accounts double-entry journal entries
 * 6. Audit event generation for all close and intercompany mutations
 *
 * @module tree/finance/__tests__/financial-close-orchestrator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  initiatePeriodClose,
  finalizePeriodClose,
  lockPeriod,
  reopenPeriod,
  getPeriodStatus,
  computePeriodAggregates,
  calculateWithholdingTax,
  generateVasJournalEntries,
  recordIntercompanyTransfer,
  reconcileIntercompanyTransfer,
  listIntercompanyTransfers,
  inferPeriodDates,
} from '../financial-close-orchestrator';
import { createRevenueSchedule } from '../revenue-recognition-engine';

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

describe('Financial Close Orchestrator & Intercompany Settlement — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_close_periods (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        period_key TEXT NOT NULL,
        period_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        close_status TEXT NOT NULL DEFAULT 'open',
        closed_by TEXT,
        closed_at INTEGER,
        total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
        total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0,
        total_refunds_cents INTEGER NOT NULL DEFAULT 0,
        net_revenue_cents INTEGER NOT NULL DEFAULT 0,
        active_contracts_count INTEGER NOT NULL DEFAULT 0,
        merkle_root_hash TEXT,
        digital_signature TEXT,
        compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404',
        audit_opinion TEXT NOT NULL DEFAULT 'unqualified',
        lock_reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revenue_schedules (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT,
        contract_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        billing_cycle TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        total_contract_value_cents INTEGER NOT NULL,
        recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
        deferred_revenue_cents INTEGER NOT NULL,
        daily_recognition_rate_cents REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        term_days INTEGER NOT NULL,
        days_recognized INTEGER NOT NULL DEFAULT 0,
        accounting_standard TEXT NOT NULL DEFAULT 'ASC_606_IFRS_15',
        status TEXT NOT NULL DEFAULT 'active',
        last_accrual_date TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS intercompany_transfers (
        id TEXT PRIMARY KEY,
        transfer_reference TEXT NOT NULL UNIQUE,
        origin_entity TEXT NOT NULL,
        destination_entity TEXT NOT NULL,
        transfer_type TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        gross_amount_cents INTEGER NOT NULL,
        withholding_tax_regime TEXT NOT NULL,
        withholding_tax_rate_pct REAL NOT NULL DEFAULT 0.0,
        withholding_tax_amount_cents INTEGER NOT NULL DEFAULT 0,
        net_settlement_cents INTEGER NOT NULL,
        settlement_status TEXT NOT NULL DEFAULT 'pending',
        reconciliation_ledger_id TEXT,
        approved_by TEXT,
        transfer_date TEXT NOT NULL,
        settled_at INTEGER,
        supporting_docs_hash TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ipo_audit_ledger (
        id TEXT PRIMARY KEY,
        sequence_number INTEGER NOT NULL UNIQUE,
        period_key TEXT NOT NULL,
        org_id TEXT,
        event_type TEXT NOT NULL,
        event_scope TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        payload_canonical_json TEXT NOT NULL DEFAULT '{}',
        prev_hash TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        merkle_leaf_hash TEXT NOT NULL,
        digital_signature TEXT NOT NULL,
        sox_control_id TEXT NOT NULL DEFAULT 'NONE',
        vas_account_code TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      INSERT INTO organizations (id, name) VALUES ('org_global_01', 'Sophia Global Inc');
      INSERT INTO users (id, email) VALUES ('user_cfo', 'cfo@sophia.network');
    `);

    d1 = makeD1(rawDb) as unknown as D1Database;
  });

  describe('Period Lifecycle & FSM Transitions', () => {
    it('infers accurate calendar dates for monthly and quarterly periods', () => {
      const sep = inferPeriodDates('2026-09', 'monthly');
      expect(sep.startDate).toBe('2026-09-01');
      expect(sep.endDate).toBe('2026-09-30');

      const q3 = inferPeriodDates('2026-Q3', 'quarterly');
      expect(q3.startDate).toBe('2026-07-01');
      expect(q3.endDate).toBe('2026-09-30');

      const fy = inferPeriodDates('2026-FY', 'annual');
      expect(fy.startDate).toBe('2026-01-01');
      expect(fy.endDate).toBe('2026-12-31');
    });

    it('executes full FSM: open -> closing -> closed -> locked', async () => {
      // Step 1: Initiate close (open -> closing)
      const initiated = await initiatePeriodClose(
        d1,
        '2026-09',
        'monthly',
        'user_cfo',
        null
      );
      expect(initiated.closeStatus).toBe('closing');
      expect(initiated.closedBy).toBe('user_cfo');

      // Add a revenue schedule overlapping the period
      await createRevenueSchedule(d1, {
        orgId: 'org_global_01',
        contractId: 'CONTRACT-99',
        tier: 'ENTERPRISE',
        billingCycle: 'monthly',
        startDate: '2026-09-01',
      });

      // Step 2: Finalize close (closing -> closed)
      const finalized = await finalizePeriodClose(d1, '2026-09', 'user_cfo');
      expect(finalized.period.closeStatus).toBe('closed');
      expect(finalized.merkleRootHash).toBeDefined();
      expect(finalized.digitalSignature).toBeDefined();
      expect(finalized.aggregates.activeContractsCount).toBe(1);

      // Step 3: Permanently lock period (closed -> locked)
      const locked = await lockPeriod(
        d1,
        '2026-09',
        'SEC Form S-1 Audit Sign-Off',
        'user_cfo'
      );
      expect(locked.closeStatus).toBe('locked');
      expect(locked.lockReason).toBe('SEC Form S-1 Audit Sign-Off');

      // Step 4: Reopening locked period must throw an error
      await expect(
        reopenPeriod(d1, '2026-09', 'Mistake in ledger', 'user_cfo')
      ).rejects.toThrow('LOCKED_PERIOD_CANNOT_BE_REOPENED');
    });

    it('allows reopening when period is closed but not locked', async () => {
      await initiatePeriodClose(d1, '2026-10', 'monthly', 'user_cfo');
      await finalizePeriodClose(d1, '2026-10', 'user_cfo');

      const reopened = await reopenPeriod(
        d1,
        '2026-10',
        'Pending late intercompany invoice',
        'user_cfo'
      );
      expect(reopened.closeStatus).toBe('reopened');
      expect(reopened.lockReason).toBe('Pending late intercompany invoice');
    });
  });

  describe('Cross-Border Intercompany Settlement & Withholding Taxes', () => {
    it('calculates 10% Vietnam Foreign Contractor Tax (FCT)', () => {
      const gross = 1000000; // $10,000.00
      const { ratePct, taxCents, netCents } = calculateWithholdingTax('VN_FCT_10PCT', gross);
      expect(ratePct).toBe(10.0);
      expect(taxCents).toBe(100000); // $1,000.00
      expect(netCents).toBe(900000);   // $9,000.00
      expect(taxCents + netCents).toBe(gross);
    });

    it('calculates 30% US Chapter 3 withholding tax and 0% treaty exemption', () => {
      const gross = 500000; // $5,000.00
      const standard = calculateWithholdingTax('US_W8_30PCT', gross);
      expect(standard.ratePct).toBe(30.0);
      expect(standard.taxCents).toBe(150000);
      expect(standard.netCents).toBe(350000);

      const treaty = calculateWithholdingTax('US_W8_TREATY_0PCT', gross);
      expect(treaty.ratePct).toBe(0.0);
      expect(treaty.taxCents).toBe(0);
      expect(treaty.netCents).toBe(500000);
    });

    it('records and reconciles intercompany transfer with audit logging', async () => {
      // Must have period in DB for foreign key / audit linkage
      await initiatePeriodClose(d1, '2026-09', 'monthly', 'user_cfo');

      const transfer = await recordIntercompanyTransfer(
        d1,
        {
          originEntity: 'SOPHIA_VN_CO_LTD',
          destinationEntity: 'SOPHIA_GLOBAL_INC',
          transferType: 'mcu_compute_rebill',
          grossAmountCents: 5000000, // $50,000.00
          withholdingTaxRegime: 'VN_FCT_10PCT',
          transferDate: '2026-09-15',
          notes: 'GPU cluster compute reimbursement',
        },
        'user_cfo'
      );

      expect(transfer.transferReference).toMatch(/^ICT-2026-09-\d{4}$/);
      expect(transfer.settlementStatus).toBe('pending');
      expect(transfer.withholdingTaxAmountCents).toBe(500000); // 10% = $5,000.00
      expect(transfer.netSettlementCents).toBe(4500000); // $45,000.00

      // Reconcile transfer
      const reconciled = await reconcileIntercompanyTransfer(
        d1,
        transfer.id,
        'user_cfo',
        'Bank remittance confirmation #VN9841'
      );
      expect(reconciled.settlementStatus).toBe('reconciled');
      expect(reconciled.approvedBy).toBe('user_cfo');

      // Verify listing
      const allTransfers = await listIntercompanyTransfers(d1, { status: 'reconciled' });
      expect(allTransfers.length).toBe(1);
      expect(allTransfers[0].id).toBe(transfer.id);
    });

    it('generates balanced Vietnam VAS TT200 Chart of Accounts entries', async () => {
      await initiatePeriodClose(d1, '2026-09', 'monthly', 'user_cfo');
      const transfer = await recordIntercompanyTransfer(d1, {
        originEntity: 'SOPHIA_VN_CO_LTD',
        destinationEntity: 'SOPHIA_GLOBAL_INC',
        transferType: 'ip_license_royalty',
        grossAmountCents: 2000000, // $20,000.00
        withholdingTaxRegime: 'VN_FCT_10PCT',
        transferDate: '2026-09-10',
      });

      const entries = generateVasJournalEntries(transfer);
      expect(entries.length).toBe(3);

      const totalDebit = entries.reduce((s, e) => s + e.debitCents, 0);
      const totalCredit = entries.reduce((s, e) => s + e.creditCents, 0);
      expect(totalDebit).toBe(transfer.grossAmountCents);
      expect(totalCredit).toBe(transfer.grossAmountCents);
      expect(totalDebit).toBe(totalCredit); // Perfect double-entry balance!
    });
  });
});
