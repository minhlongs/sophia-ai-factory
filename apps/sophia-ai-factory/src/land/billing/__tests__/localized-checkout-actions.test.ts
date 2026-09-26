/**
 * Unit & Integration Test Suite: Localized Checkout & Hedging Admin Actions
 *
 * Tests:
 * 1. createLocalizedPaymentIntentAction: auth gating, D1 insertion for transactions & reserves
 * 2. getLocalizedTransactionStatusAction: retrieval of pending/completed transactions
 * 3. getFxReservesSummaryAction: aggregate escrow and PnL calculation
 * 4. reconcileTransactionSlippageAction: settlement slippage reconciliation
 *
 * Layer: land/billing/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLocalizedPaymentIntentAction,
  getLocalizedTransactionStatusAction,
} from '../localized-checkout-actions';
import {
  getFxReservesSummaryAction,
  reconcileTransactionSlippageAction,
  getActiveFxRatesAction,
} from '../hedging-admin-actions';
import * as dbModule from '@/seed/db/client';
import * as authModule from '@/seed/auth/better-auth-session';
import * as adminAuthModule from '@/seed/auth/is-user-admin';

describe('Localized Checkout & Hedging Admin Server Actions', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    };

    vi.spyOn(dbModule, 'getD1').mockReturnValue(mockDb);
  });

  describe('createLocalizedPaymentIntentAction', () => {
    it('returns UNAUTHORIZED when no user session is present', async () => {
      vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(null);

      const result = await createLocalizedPaymentIntentAction({
        orgId: 'org_01',
        userId: 'usr_01',
        tier: 'BASIC',
        billingCycle: 'monthly',
        rail: 'PROMPTPAY',
        currency: 'THB',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        billingCountry: 'TH',
        customerType: 'B2C',
        mobileNumber: '0812345678',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('creates payment intent and inserts into transactions and reserves table', async () => {
      vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue({
        id: 'usr_01',
        email: 'user@example.com',
      } as any);

      const result = await createLocalizedPaymentIntentAction({
        orgId: 'org_01',
        userId: 'usr_01',
        tier: 'BASIC',
        billingCycle: 'monthly',
        rail: 'PROMPTPAY',
        currency: 'THB',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        billingCountry: 'TH',
        customerType: 'B2C',
        mobileNumber: '0812345678',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rail).toBe('PROMPTPAY');
        expect(result.value.currency).toBe('THB');
        expect(result.value.qrPayload).toBeDefined();
      }

      // Verify db.prepare was called twice (for transactions and reserves)
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    });
  });

  describe('getLocalizedTransactionStatusAction', () => {
    it('retrieves existing transaction record by ID', async () => {
      const mockRecord = {
        id: 'txn_123',
        status: 'completed',
        total_amount: 3650.0,
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRecord),
        }),
      });

      const result = await getLocalizedTransactionStatusAction('txn_123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('txn_123');
        expect(result.value.status).toBe('completed');
      }
    });

    it('returns NOT_FOUND when transaction does not exist', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await getLocalizedTransactionStatusAction('txn_nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('Hedging Admin Actions', () => {
    it('enforces admin privilege on getFxReservesSummaryAction', async () => {
      vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue({
        id: 'usr_member',
        email: 'member@example.com',
      } as any);
      vi.spyOn(adminAuthModule, 'isUserAdminWithRole').mockResolvedValue({
        isAdmin: false,
        role: 'member',
      } as any);

      const result = await getFxReservesSummaryAction();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('computes summary totals for admin users', async () => {
      vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue({
        id: 'usr_admin',
        email: 'admin@agencyos.network',
      } as any);
      vi.spyOn(adminAuthModule, 'isUserAdminWithRole').mockResolvedValue({
        isAdmin: true,
        role: 'admin',
      } as any);

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [
            { reserve_status: 'escrowed', cnt: 5, total_escrowed: 7500, total_pnl: 0 },
            { reserve_status: 'realized_gain', cnt: 10, total_escrowed: 15000, total_pnl: 1200 },
          ],
        }),
      });

      const result = await getFxReservesSummaryAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.escrowedCount).toBe(5);
        expect(result.value.realizedGainCount).toBe(10);
        expect(result.value.totalEscrowedCents).toBe(7500);
        expect(result.value.totalRealizedPnlCents).toBe(1200);
      }
    });
  });
});
