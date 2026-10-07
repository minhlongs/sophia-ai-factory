import { describe, it, expect, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getAffiliateLedgerStats,
  getPartnerSummary,
  getPartnerLedgerStats,
  createPayoutDisbursement,
  approvePayoutDisbursement,
  completePayoutDisbursement,
  updateCommissionStatusWithOcc,
  getAffiliateOffers,
} from '@/tree/affiliates/affiliate-ledger-service';
import {
  recordAffiliateCommission,
  safelyRecordAffiliateCommission,
} from '@/tree/affiliates/affiliate-attribution';
import type {
  AffiliatePartnerRow,
  AffiliateCommissionRow,
  AffiliatePayoutRow,
  AffiliateReferralRow,
  AffiliateOfferRow,
} from '@/seed/types/affiliate';

/**
 * In-memory D1 mock engine supporting SQLite statements, transactions,
 * ON CONFLICT DO NOTHING, and OCC version checks.
 */
function createMockD1Database() {
  const partners = new Map<string, AffiliatePartnerRow>();
  const commissions = new Map<string, AffiliateCommissionRow>(); // key: event_key
  const payouts = new Map<string, AffiliatePayoutRow>(); // key: id
  const referrals = new Map<string, AffiliateReferralRow>(); // key: id
  const offers = new Map<string, AffiliateOfferRow>(); // key: id

  const d1Mock: Partial<D1Database> = {
    prepare(sql: string) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      let boundParams: unknown[] = [];

      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params;
          return stmt;
        },

        async first<T>(): Promise<T | null> {
          // SELECT * FROM affiliate_partners WHERE id = ?1 OR user_id = ?1 OR partner_code = ?1
          if (
            normalizedSql.includes('FROM affiliate_partners WHERE id =') ||
            normalizedSql.includes('FROM affiliate_partners WHERE (partner_code =')
          ) {
            const idOrCode = boundParams[0] as string;
            for (const p of partners.values()) {
              if (p.id === idOrCode || p.user_id === idOrCode || p.partner_code === idOrCode) {
                return { ...p } as unknown as T;
              }
            }
            return null;
          }

          // Single partner lookup by id
          if (normalizedSql.includes('FROM affiliate_partners WHERE id = ?1')) {
            const id = boundParams[0] as string;
            const p = partners.get(id);
            return p ? ({ ...p } as unknown as T) : null;
          }

          // Partner code lookup
          if (normalizedSql.includes('FROM affiliate_partners WHERE partner_code = ?1')) {
            const code = boundParams[0] as string;
            for (const p of partners.values()) {
              if (p.partner_code === code) return { ...p } as unknown as T;
            }
            return null;
          }

          // COUNT(*) AS total_partners ... FROM affiliate_partners
          if (
            normalizedSql.includes('COUNT(*) AS total_partners') &&
            normalizedSql.includes('FROM affiliate_partners')
          ) {
            let total = 0;
            let active = 0;
            for (const p of partners.values()) {
              total++;
              if (p.status === 'active') active++;
            }
            return { total_partners: total, active_partners: active } as unknown as T;
          }

          // SUM(commission_cents) ... FROM affiliate_commissions
          if (
            normalizedSql.includes('SUM(commission_cents) AS total_comm') &&
            normalizedSql.includes('FROM affiliate_commissions')
          ) {
            let totalComm = 0;
            let pendingComm = 0;
            let settledComm = 0;
            for (const c of commissions.values()) {
              totalComm += c.commission_cents;
              if (c.status === 'pending' || c.status === 'payable') {
                pendingComm += c.commission_cents;
              }
              if (c.status === 'settled') {
                settledComm += c.commission_cents;
              }
            }
            return {
              total_comm: totalComm,
              pending_comm: pendingComm,
              settled_comm: settledComm,
            } as unknown as T;
          }

          // SELECT id FROM affiliate_commissions WHERE event_key = ?1
          if (normalizedSql.includes('FROM affiliate_commissions WHERE event_key = ?1')) {
            const key = boundParams[0] as string;
            const c = commissions.get(key);
            return c ? ({ id: c.id } as unknown as T) : null;
          }

          // SELECT * FROM affiliate_payouts WHERE id = ?1
          if (normalizedSql.includes('FROM affiliate_payouts WHERE id = ?1')) {
            const id = boundParams[0] as string;
            const p = payouts.get(id);
            return p ? ({ ...p } as unknown as T) : null;
          }

          // SELECT COUNT(*) AS total_referrals ... FROM affiliate_referrals WHERE partner_id = ?1
          if (
            normalizedSql.includes('total_referrals') &&
            normalizedSql.includes('FROM affiliate_referrals')
          ) {
            const partnerId = boundParams[0] as string;
            let total = 0;
            let converted = 0;
            for (const r of referrals.values()) {
              if (r.partner_id === partnerId) {
                total++;
                if (r.status === 'converted') converted++;
              }
            }
            return { total_referrals: total, converted_referrals: converted } as unknown as T;
          }

          // Referral binding lookup
          if (normalizedSql.includes('FROM affiliate_referrals WHERE referred_user_id = ?1')) {
            const customerId = boundParams[0] as string;
            for (const r of referrals.values()) {
              if (
                r.referred_user_id === customerId &&
                (r.status === 'pending' || r.status === 'converted')
              ) {
                return { ...r } as unknown as T;
              }
            }
            return null;
          }

          return null;
        },

        async all<T>(): Promise<{ results: T[] }> {
          if (normalizedSql.includes("FROM affiliate_offers WHERE status = 'active'")) {
            const list = Array.from(offers.values()).filter((o) => o.status === 'active');
            return { results: list as unknown as T[] };
          }
          return { results: [] };
        },

        async run(): Promise<{ meta: { changes: number } }> {
          // INSERT INTO affiliate_payouts
          if (normalizedSql.startsWith('INSERT INTO affiliate_payouts')) {
            const [
              id,
              payout_reference,
              partner_id,
              rail,
              amount_cents,
              currency,
              destination_encrypted,
              created_at,
              updated_at,
            ] = boundParams;

            payouts.set(id as string, {
              id: id as string,
              payout_reference: payout_reference as string,
              partner_id: partner_id as string,
              rail: rail as any,
              amount_cents: amount_cents as number,
              currency: currency as string,
              destination_encrypted: destination_encrypted as string,
              status: 'draft',
              commission_count: 0,
              tx_hash_or_bank_ref: null,
              approved_by: null,
              approved_at: null,
              failure_reason: null,
              version: 1,
              created_at: created_at as number,
              updated_at: updated_at as number,
            });
            return { meta: { changes: 1 } };
          }

          // UPDATE affiliate_payouts SET status = 'approved' ... WHERE id = ?3 AND version = ?4
          if (
            normalizedSql.includes('UPDATE affiliate_payouts') &&
            normalizedSql.includes("SET status = 'approved'")
          ) {
            const approvedBy = boundParams[0] as string;
            const now = boundParams[1] as number;
            const id = boundParams[2] as string;
            const version = boundParams[3] as number;

            const existing = payouts.get(id);
            if (
              existing &&
              existing.version === version &&
              (existing.status === 'draft' || existing.status === 'pending_approval')
            ) {
              existing.status = 'approved';
              existing.approved_by = approvedBy;
              existing.approved_at = now;
              existing.version += 1;
              existing.updated_at = now;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          // UPDATE affiliate_payouts SET status = 'completed' ... WHERE id = ?3 AND version = ?4
          if (
            normalizedSql.includes('UPDATE affiliate_payouts') &&
            normalizedSql.includes("SET status = 'completed'")
          ) {
            const txHash = boundParams[0] as string;
            const now = boundParams[1] as number;
            const id = boundParams[2] as string;
            const version = boundParams[3] as number;

            const existing = payouts.get(id);
            if (existing && existing.version === version && existing.status === 'approved') {
              existing.status = 'completed';
              existing.tx_hash_or_bank_ref = txHash;
              existing.version += 1;
              existing.updated_at = now;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          // UPDATE affiliate_commissions SET status = ?1 ... WHERE id = ?4 AND version = ?5
          if (
            normalizedSql.includes('UPDATE affiliate_commissions') &&
            normalizedSql.includes('WHERE id = ?4 AND version = ?5')
          ) {
            const targetStatus = boundParams[0] as any;
            const payoutId = boundParams[1] as string | null;
            const now = boundParams[2] as number;
            const id = boundParams[3] as string;
            const version = boundParams[4] as number;

            for (const c of commissions.values()) {
              if (c.id === id) {
                if (c.version === version) {
                  c.status = targetStatus;
                  if (payoutId) c.payout_id = payoutId;
                  c.version += 1;
                  c.updated_at = now;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
            }
            return { meta: { changes: 0 } };
          }

          // INSERT INTO affiliate_commissions ... ON CONFLICT(event_key) DO NOTHING
          if (normalizedSql.startsWith('INSERT INTO affiliate_commissions')) {
            const isTier2 = normalizedSql.includes("'TIER2'");
            const [
              id,
              event_key,
              partner_id,
              referral_id,
              payment_provider,
              payment_id,
              order_id,
              customer_user_id,
              gross_amount_cents,
              commission_rate_pct,
              commission_cents,
              currency,
              payable_at,
              metadata_json,
              created_at,
              updated_at,
            ] = boundParams;

            const key = event_key as string;
            if (commissions.has(key)) {
              // Idempotency: duplicate insertion avoided
              return { meta: { changes: 0 } };
            }

            commissions.set(key, {
              id: id as string,
              event_key: key,
              partner_id: partner_id as string,
              referral_id: referral_id as string | null,
              payment_provider: payment_provider as any,
              payment_id: payment_id as string,
              order_id: order_id as string | null,
              customer_user_id: customer_user_id as string,
              gross_amount_cents: gross_amount_cents as number,
              commission_rate_pct: commission_rate_pct as number,
              commission_cents: commission_cents as number,
              tier_level: isTier2 ? 'TIER2' : 'TIER1',
              currency: currency as string,
              status: 'pending',
              hold_days: 14,
              payable_at: payable_at as number,
              settled_at: null,
              payout_id: null,
              version: 1,
              metadata_json: metadata_json as string | null,
              created_at: created_at as number,
              updated_at: updated_at as number,
            });

            return { meta: { changes: 1 } };
          }

          // UPDATE affiliate_partners SET pending_payout_cents = pending_payout_cents + ?1 ...
          if (
            normalizedSql.includes('UPDATE affiliate_partners') &&
            normalizedSql.includes('pending_payout_cents = pending_payout_cents +')
          ) {
            const addPending = boundParams[0] as number;
            const now = boundParams[1] as number;
            const id = boundParams[2] as string;

            const p = partners.get(id);
            if (p) {
              p.pending_payout_cents += addPending;
              p.total_earnings_cents += addPending;
              p.updated_at = now;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          // UPDATE affiliate_partners SET pending_payout_cents = MAX(0, pending_payout_cents - ?1)
          if (
            normalizedSql.includes('UPDATE affiliate_partners') &&
            normalizedSql.includes('pending_payout_cents = MAX(0, pending_payout_cents -')
          ) {
            const deduct = boundParams[0] as number;
            const now = boundParams[1] as number;
            const id = boundParams[2] as string;

            const p = partners.get(id);
            if (p) {
              p.pending_payout_cents = Math.max(0, p.pending_payout_cents - deduct);
              p.settled_payout_cents = (p.settled_payout_cents ?? 0) + deduct;
              p.updated_at = now;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          // UPDATE affiliate_referrals SET status = 'converted'
          if (
            normalizedSql.includes('UPDATE affiliate_referrals') &&
            normalizedSql.includes("status = 'converted'")
          ) {
            const now = boundParams[0] as number;
            const id = boundParams[1] as string;
            const r = referrals.get(id);
            if (r) {
              r.status = 'converted';
              r.converted_at = now;
              r.updated_at = now;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }

          // UPDATE affiliate_commissions SET status = 'settled'
          if (
            normalizedSql.includes('UPDATE affiliate_commissions') &&
            normalizedSql.includes("status = 'settled'")
          ) {
            const now = boundParams[0] as number;
            const payoutId = boundParams[1] as string;
            for (const c of commissions.values()) {
              if (c.payout_id === payoutId && c.status === 'payable') {
                c.status = 'settled';
                c.settled_at = now;
                c.version += 1;
                c.updated_at = now;
              }
            }
            return { meta: { changes: 1 } };
          }

          return { meta: { changes: 1 } };
        },
      };

      return stmt as any;
    },

    async batch(statements: any[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results as any;
    },
  };

  return {
    d1: d1Mock as D1Database,
    store: {
      partners,
      commissions,
      payouts,
      referrals,
      offers,
    },
  };
}

describe('Affiliate Ledger & Attribution Engine — Milestone 1 Comprehensive Suite', () => {
  let mockEngine: ReturnType<typeof createMockD1Database>;
  let mockD1: D1Database;

  beforeEach(() => {
    mockEngine = createMockD1Database();
    mockD1 = mockEngine.d1;

    // Seed mock partner: partner_1 (SILVER 20%)
    mockEngine.store.partners.set('partner_1', {
      id: 'partner_1',
      user_id: 'user_partner_1',
      partner_code: 'SILVER_HERO',
      tier: 'SILVER',
      commission_rate_pct: 20.0,
      tier2_rate_pct: 5.0,
      parent_partner_id: null,
      usdt_trc20_address_encrypted: 'enc_trc20_addr_123',
      status: 'active',
      total_earnings_cents: 10000,
      pending_payout_cents: 10000,
      settled_payout_cents: 0,
      payout_rail: 'USDT',
      created_at: Date.now() - 86400000,
      updated_at: Date.now() - 86400000,
    });

    // Seed mock parent partner: parent_partner_vip (GOLD 25%, tier2 5%)
    mockEngine.store.partners.set('parent_partner_vip', {
      id: 'parent_partner_vip',
      user_id: 'user_parent_vip',
      partner_code: 'GOLD_LEADER',
      tier: 'GOLD',
      commission_rate_pct: 25.0,
      tier2_rate_pct: 5.0,
      parent_partner_id: null,
      usdt_trc20_address_encrypted: 'enc_trc20_vip_addr',
      status: 'active',
      total_earnings_cents: 2000000,
      pending_payout_cents: 2000000,
      settled_payout_cents: 0,
      payout_rail: 'VIETQR',
      bank_bin: '970422',
      bank_account_number: '1234567890',
      bank_account_name: 'NGUYEN VAN A',
      created_at: Date.now() - 86400000,
      updated_at: Date.now() - 86400000,
    });
  });

  describe('1. Idempotent Commission Attribution (NOWPayments & PayOS)', () => {
    it('attributes initial commission correctly upon valid payment', async () => {
      // Setup referral binding
      mockEngine.store.referrals.set('ref_1', {
        id: 'ref_1',
        partner_id: 'partner_1',
        partner_code: 'SILVER_HERO',
        referred_user_id: 'customer_alice',
        sub_id: 'tiktok_viral',
        attribution_token: 'tok_alice_123',
        click_id: 'clk_1',
        ip_hash: 'hash_123',
        user_agent: 'Mozilla/5.0',
        status: 'pending',
        converted_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const result = await recordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'np_tx_998877',
          orderId: 'order_101',
          customerId: 'customer_alice',
          grossAmountCents: 100000, // $1,000.00
          currency: 'USDT',
        },
        mockD1
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(true);
      expect(result.partnerId).toBe('partner_1');
      expect(result.commissionCents).toBe(20000); // 20% of $1,000 = $200 (20,000 cents)

      // Verify commission stored in ledger
      const comm = mockEngine.store.commissions.get('affiliate_comm_nowpayments_np_tx_998877');
      expect(comm).toBeDefined();
      expect(comm?.commission_cents).toBe(20000);
      expect(comm?.status).toBe('pending');
      expect(comm?.tier_level).toBe('TIER1');

      // Verify referral converted
      const ref = mockEngine.store.referrals.get('ref_1');
      expect(ref?.status).toBe('converted');
      expect(ref?.converted_at).not.toBeNull();

      // Verify partner balance increased
      const partner = mockEngine.store.partners.get('partner_1');
      expect(partner?.pending_payout_cents).toBe(30000); // 10000 + 20000
    });

    it('rejects duplicate webhook events idempotently without double-crediting balances', async () => {
      mockEngine.store.referrals.set('ref_1', {
        id: 'ref_1',
        partner_id: 'partner_1',
        partner_code: 'SILVER_HERO',
        referred_user_id: 'customer_alice',
        sub_id: null,
        attribution_token: 'tok_alice_123',
        click_id: null,
        ip_hash: null,
        user_agent: null,
        status: 'pending',
        converted_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      // First webhook delivery
      const firstRun = await recordAffiliateCommission(
        {
          provider: 'payos',
          paymentId: 'payos_order_3344',
          orderId: 'order_payos_1',
          customerId: 'customer_alice',
          grossAmountCents: 50000, // $500.00
          currency: 'VND',
        },
        mockD1
      );
      expect(firstRun.attributed).toBe(true);
      expect(firstRun.commissionCents).toBe(10000);

      const balanceAfterFirst = mockEngine.store.partners.get('partner_1')!.pending_payout_cents;
      expect(balanceAfterFirst).toBe(20000); // 10000 + 10000

      // Duplicate webhook delivery with identical paymentId
      const secondRun = await recordAffiliateCommission(
        {
          provider: 'payos',
          paymentId: 'payos_order_3344',
          orderId: 'order_payos_1',
          customerId: 'customer_alice',
          grossAmountCents: 50000,
          currency: 'VND',
        },
        mockD1
      );

      expect(secondRun.success).toBe(true);
      expect(secondRun.attributed).toBe(false);
      expect(secondRun.reason).toBe('ALREADY_ATTRIBUTED');

      // Ensure balance was NOT double credited
      const balanceAfterDuplicate = mockEngine.store.partners.get('partner_1')!.pending_payout_cents;
      expect(balanceAfterDuplicate).toBe(balanceAfterFirst);
    });

    it('safely catches errors and never throws uncaught exceptions via safelyRecordAffiliateCommission', async () => {
      const mockFailingD1 = {
        prepare: () => {
          throw new Error('SIMULATED_D1_NETWORK_CRASH');
        },
      } as unknown as D1Database;

      const result = await safelyRecordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'broken_tx',
          customerId: 'cust_err',
          grossAmountCents: 10000,
        },
        mockFailingD1
      );

      expect(result.success).toBe(false);
      expect(result.attributed).toBe(false);
      expect(result.error).toContain('SIMULATED_D1_NETWORK_CRASH');
    });

    it('blocks self-referral attempts when partner user_id matches customerId', async () => {
      const result = await recordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'self_ref_attempt',
          customerId: 'user_partner_1', // Partner purchasing for themselves
          grossAmountCents: 10000,
          partnerCodeOverride: 'SILVER_HERO',
        },
        mockD1
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(false);
      expect(result.reason).toBe('SELF_REFERRAL_DISALLOWED');

      // Ensure no commission recorded
      expect(mockEngine.store.commissions.has('affiliate_comm_nowpayments_self_ref_attempt')).toBe(false);
    });

    it('attributes 2-Tier commission to parent partner correctly', async () => {
      // Connect partner_1 to parent_partner_vip
      const child = mockEngine.store.partners.get('partner_1')!;
      child.parent_partner_id = 'parent_partner_vip';

      const result = await recordAffiliateCommission(
        {
          provider: 'nowpayments',
          paymentId: 'tx_two_tier_777',
          customerId: 'customer_charlie',
          grossAmountCents: 200000, // $2,000.00
          partnerCodeOverride: 'SILVER_HERO',
        },
        mockD1
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(true);
      expect(result.tier2CommissionId).toBeDefined();

      // Tier 1 commission: 20% of $2,000 = $400 (40,000 cents)
      const t1Comm = mockEngine.store.commissions.get('affiliate_comm_nowpayments_tx_two_tier_777');
      expect(t1Comm?.commission_cents).toBe(40000);
      expect(t1Comm?.tier_level).toBe('TIER1');

      // Tier 2 commission: 5% of $2,000 = $100 (10,000 cents)
      const t2Comm = mockEngine.store.commissions.get('affiliate_comm_nowpayments_tx_two_tier_777_tier2');
      expect(t2Comm?.commission_cents).toBe(10000);
      expect(t2Comm?.tier_level).toBe('TIER2');
      expect(t2Comm?.partner_id).toBe('parent_partner_vip');

      // Verify parent partner balance updated
      const parent = mockEngine.store.partners.get('parent_partner_vip')!;
      expect(parent.pending_payout_cents).toBe(2010000); // 2000000 + 10000
    });
  });

  describe('2. Optimistic Concurrency Control (OCC) Version Locking', () => {
    it('handles atomic payout creation and version increment', async () => {
      const createRes = await createPayoutDisbursement({
        partnerId: 'partner_1',
        rail: 'USDT',
        amountCents: 5000,
        destinationEncrypted: 'enc_trc20_wallet_test',
        d1: mockD1,
      });

      expect(createRes.success).toBe(true);
      expect(createRes.payoutId).toBeDefined();
      expect(createRes.payoutReference).toMatch(/^PO_\d{8}_[A-Z0-9]{6}$/);

      const payout = mockEngine.store.payouts.get(createRes.payoutId!)!;
      expect(payout.version).toBe(1);
      expect(payout.status).toBe('draft');
      expect(payout.amount_cents).toBe(5000);
    });

    it('rejects concurrent payout approval with stale version (OCC conflict)', async () => {
      const createRes = await createPayoutDisbursement({
        partnerId: 'partner_1',
        rail: 'USDT',
        amountCents: 5000,
        destinationEncrypted: 'enc_trc20_wallet_test',
        d1: mockD1,
      });
      const payoutId = createRes.payoutId!;

      // First admin approves with currentVersion = 1 -> SUCCESS (version becomes 2)
      const firstApproval = await approvePayoutDisbursement({
        payoutId,
        currentVersion: 1,
        approvedBy: 'admin_alice',
        d1: mockD1,
      });
      expect(firstApproval.success).toBe(true);
      expect(firstApproval.newVersion).toBe(2);

      // Concurrent second admin tries to approve with stale currentVersion = 1 -> OCC CONFLICT!
      const conflictingApproval = await approvePayoutDisbursement({
        payoutId,
        currentVersion: 1,
        approvedBy: 'admin_bob',
        d1: mockD1,
      });
      expect(conflictingApproval.success).toBe(false);
      expect(conflictingApproval.conflict).toBe(true);
      expect(conflictingApproval.error).toBe('OCC_VERSION_CONFLICT');
    });

    it('completes approved payout and rejects conflicting settlement with stale version', async () => {
      const createRes = await createPayoutDisbursement({
        partnerId: 'partner_1',
        rail: 'USDT',
        amountCents: 4000,
        destinationEncrypted: 'enc_trc20_wallet_test',
        d1: mockD1,
      });
      const payoutId = createRes.payoutId!;

      // Approve: version 1 -> 2
      const appRes = await approvePayoutDisbursement({
        payoutId,
        currentVersion: 1,
        approvedBy: 'admin_audit',
        d1: mockD1,
      });
      const pBefore = mockEngine.store.payouts.get(payoutId);

      // Complete disbursement: version 2 -> 3
      const completeRes = await completePayoutDisbursement({
        payoutId,
        currentVersion: 2,
        txHashOrBankRef: '0xabc123trc20txhash',
        d1: mockD1,
      });
      expect(completeRes.error).toBeUndefined();
      expect(completeRes.success).toBe(true);
      expect(completeRes.newVersion).toBe(3);

      const payout = mockEngine.store.payouts.get(payoutId)!;
      expect(payout.status).toBe('completed');
      expect(payout.tx_hash_or_bank_ref).toBe('0xabc123trc20txhash');

      // Verify partner balance deducted and settled increased
      const partner = mockEngine.store.partners.get('partner_1')!;
      expect(partner.pending_payout_cents).toBe(6000); // 10000 - 4000
      expect(partner.settled_payout_cents).toBe(4000);

      // Concurrent / duplicate completion with old version 2 -> OCC CONFLICT!
      const duplicateComplete = await completePayoutDisbursement({
        payoutId,
        currentVersion: 2,
        txHashOrBankRef: '0xduplicate',
        d1: mockD1,
      });
      expect(duplicateComplete.success).toBe(false);
      expect(duplicateComplete.conflict).toBe(true);
    });

    it('enforces OCC on commission status updates', async () => {
      // Seed a commission with version 1
      mockEngine.store.commissions.set('affiliate_comm_test_occ', {
        id: 'comm_occ_1',
        event_key: 'affiliate_comm_test_occ',
        partner_id: 'partner_1',
        referral_id: null,
        payment_provider: 'nowpayments',
        payment_id: 'test_occ',
        order_id: null,
        customer_user_id: 'cust_occ',
        gross_amount_cents: 50000,
        commission_rate_pct: 20.0,
        commission_cents: 10000,
        tier_level: 'TIER1',
        currency: 'USD',
        status: 'pending',
        hold_days: 14,
        payable_at: Date.now() + 1000000,
        settled_at: null,
        payout_id: null,
        version: 1,
        metadata_json: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      // Update to 'payable' with version 1 -> SUCCESS (becomes version 2)
      const res1 = await updateCommissionStatusWithOcc({
        commissionId: 'comm_occ_1',
        currentVersion: 1,
        targetStatus: 'payable',
        d1: mockD1,
      });
      expect(res1.success).toBe(true);
      expect(res1.newVersion).toBe(2);

      // Concurrent update with stale version 1 -> OCC CONFLICT!
      const resConflict = await updateCommissionStatusWithOcc({
        commissionId: 'comm_occ_1',
        currentVersion: 1,
        targetStatus: 'settled',
        d1: mockD1,
      });
      expect(resConflict.success).toBe(false);
      expect(resConflict.conflict).toBe(true);
    });
  });

  describe('3. Payout Calculations and Aggregations', () => {
    it('aggregates platform-wide ledger stats accurately', async () => {
      // Seed commissions with various statuses
      mockEngine.store.commissions.set('c1', {
        id: 'c1',
        event_key: 'c1',
        partner_id: 'partner_1',
        referral_id: null,
        payment_provider: 'nowpayments',
        payment_id: 'p1',
        order_id: null,
        customer_user_id: 'u1',
        gross_amount_cents: 10000,
        commission_rate_pct: 20,
        commission_cents: 2000,
        tier_level: 'TIER1',
        currency: 'USD',
        status: 'pending',
        hold_days: 14,
        payable_at: Date.now(),
        settled_at: null,
        payout_id: null,
        version: 1,
        metadata_json: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      mockEngine.store.commissions.set('c2', {
        id: 'c2',
        event_key: 'c2',
        partner_id: 'partner_1',
        referral_id: null,
        payment_provider: 'nowpayments',
        payment_id: 'p2',
        order_id: null,
        customer_user_id: 'u2',
        gross_amount_cents: 20000,
        commission_rate_pct: 20,
        commission_cents: 4000,
        tier_level: 'TIER1',
        currency: 'USD',
        status: 'settled',
        hold_days: 14,
        payable_at: Date.now(),
        settled_at: Date.now(),
        payout_id: 'po_1',
        version: 2,
        metadata_json: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const stats = await getAffiliateLedgerStats(mockD1);
      expect(stats.totalAffiliates).toBe(2); // partner_1 and parent_partner_vip
      expect(stats.activeAffiliates).toBe(2);
      expect(stats.totalCommissionCents).toBe(6000);
      expect(stats.pendingCommissionCents).toBe(2000);
      expect(stats.settledCommissionCents).toBe(4000);
    });

    it('rejects payout creation when requested amount exceeds pending balance', async () => {
      const res = await createPayoutDisbursement({
        partnerId: 'partner_1',
        rail: 'USDT',
        amountCents: 99999999, // Way more than 10000 pending cents
        destinationEncrypted: 'enc_addr',
        d1: mockD1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('INSUFFICIENT_PENDING_BALANCE');
    });

    it('returns partner summary and ledger stats', async () => {
      const summary = await getPartnerSummary('SILVER_HERO', mockD1);
      expect(summary).not.toBeNull();
      expect(summary?.partnerCode).toBe('SILVER_HERO');
      expect(summary?.tier).toBe('SILVER');
      expect(summary?.commissionRatePct).toBe(20.0);

      const activity = await getPartnerLedgerStats('partner_1', mockD1);
      expect(activity).not.toBeNull();
      expect(activity?.totalEarningsCents).toBe(10000);
      expect(activity?.pendingPayoutCents).toBe(10000);
    });
  });

  describe('4. Dual-Rail Payout Records (USDT TRC-20 & VietQR)', () => {
    it('creates and validates USDT TRC-20 payout disbursement', async () => {
      const res = await createPayoutDisbursement({
        partnerId: 'partner_1',
        rail: 'USDT',
        amountCents: 5000,
        currency: 'USD',
        destinationEncrypted: 'enc_trc20_address_xyz',
        d1: mockD1,
      });

      expect(res.success).toBe(true);
      const row = mockEngine.store.payouts.get(res.payoutId!)!;
      expect(row.rail).toBe('USDT');
      expect(row.currency).toBe('USD');
      expect(row.destination_encrypted).toBe('enc_trc20_address_xyz');
    });

    it('creates and validates VietQR (NAPAS 247) payout disbursement', async () => {
      const res = await createPayoutDisbursement({
        partnerId: 'parent_partner_vip',
        rail: 'VIETQR',
        amountCents: 1500000, // 15,000.00 within 2,000,000 cents balance
        destinationEncrypted: 'enc_vietqr_bank_json_payload',
        d1: mockD1,
      });

      expect(res.success).toBe(true);
      const row = mockEngine.store.payouts.get(res.payoutId!)!;
      expect(row.rail).toBe('VIETQR');
      expect(row.currency).toBe('VND');
      expect(row.destination_encrypted).toBe('enc_vietqr_bank_json_payload');
    });
  });

  describe('5. AI Offer Discovery Queries & Authentic Seeding Fallback', () => {
    it('returns authentic partner programs with category and payout model filters', async () => {
      const res = await getAffiliateOffers(
        {
          category: 'SaaS',
          payoutModel: 'Recurring',
        },
        mockD1
      );

      expect(res.offers.length).toBeGreaterThan(0);
      for (const offer of res.offers) {
        expect(offer.category.toLowerCase()).toBe('saas');
        expect(offer.payoutModel.toLowerCase()).toBe('recurring');
        expect(offer.destinationUrl.startsWith('https://')).toBe(true);
        // Verify zero fake URLs
        expect(offer.destinationUrl.includes('example.com')).toBe(false);
      }
    });

    it('searches programs by keyword accurately', async () => {
      const res = await getAffiliateOffers({ search: 'Canva' }, mockD1);
      expect(res.offers.length).toBeGreaterThan(0);
      expect(res.offers.some((o) => o.programName.includes('Canva'))).toBe(true);
    });

    it('sorts programs by epc descending by default', async () => {
      const res = await getAffiliateOffers({ sortBy: 'epc' }, mockD1);
      expect(res.offers.length).toBeGreaterThan(1);
      for (let i = 0; i < res.offers.length - 1; i++) {
        expect(res.offers[i].epc).toBeGreaterThanOrEqual(res.offers[i + 1].epc);
      }
    });
  });
});
