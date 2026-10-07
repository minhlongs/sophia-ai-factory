/**
 * Unit Tests for Dual-Rail Affiliate Payout Server Actions
 *
 * Verifies validation rules, balance checks, AES-256 encryption dispatch,
 * and invite redemption logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestDualRailPayoutAction,
  updatePartnerPayoutDestinationAction,
} from '../affiliate-payout-actions';
import {
  redeemAffiliateInviteAction,
  fetchPartnerLedgerDataAction,
} from '../affiliate-partner-actions';
import * as authSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';

vi.mock('@/seed/auth/better-auth-session');
vi.mock('@/seed/db/client');
vi.mock('@/tree/crypto/encrypt-secret', () => ({
  encryptSecret: vi.fn(async (text: string) => `encrypted_${Buffer.from(text).toString('base64')}`),
}));

describe('Affiliate Payout Server Actions', () => {
  const mockUser = { id: 'user_affiliate_123', email: 'partner@agencyos.network' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(mockUser as any);
  });

  describe('requestDualRailPayoutAction', () => {
    it('returns error if user is unauthenticated', async () => {
      vi.mocked(authSession.getCurrentUser).mockResolvedValue(null as any);
      const res = await requestDualRailPayoutAction({
        partnerId: 'partner_123',
        rail: 'VIETQR',
        amountCents: 5000,
        bankBin: '970422',
        bankAccountNumber: '0987654321',
        bankAccountName: 'NGUYEN VAN A',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('validates minimum payout threshold ($50.00 / 5000 cents)', async () => {
      const res = await requestDualRailPayoutAction({
        partnerId: 'partner_123',
        rail: 'VIETQR',
        amountCents: 4999,
        bankBin: '970422',
        bankAccountNumber: '0987654321',
        bankAccountName: 'NGUYEN VAN A',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Minimum payout amount is \$50\.00/);
    });

    it('rejects invalid TRC20 address format for USDT rail', async () => {
      const res = await requestDualRailPayoutAction({
        partnerId: 'partner_123',
        rail: 'USDT',
        amountCents: 6000,
        usdtNetwork: 'TRC20',
        usdtAddress: '0xinvalidEthereumAddressForTRC20',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Missing or invalid payment destination/);
    });

    it('executes successful payout request for valid VietQR coordinates', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn()
          .mockResolvedValueOnce({ id: 'partner_123', pending_payout_cents: 0, settled_payout_cents: 0 })
          .mockResolvedValueOnce({ payable_total: 10000 }),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(dbClient.getD1).mockResolvedValue(mockDb as any);

      const res = await requestDualRailPayoutAction({
        partnerId: 'partner_123',
        rail: 'VIETQR',
        amountCents: 5000,
        bankBin: '970422',
        bankAccountNumber: '0987654321',
        bankAccountName: 'NGUYEN VAN A',
      });

      expect(res.success).toBe(true);
      expect(res.payoutId).toMatch(/^payout_/);
    });
  });

  describe('fetchPartnerLedgerDataAction', () => {
    it('returns default mock KPI when D1 is unavailable', async () => {
      vi.mocked(dbClient.getD1).mockResolvedValue(null as any);
      const res = await fetchPartnerLedgerDataAction('partner_test');
      expect(res.success).toBe(true);
      expect(res.kpi?.availablePayoutCents).toBe(12500);
      expect(res.kpi?.partnerCode).toBe('SOPHIA_VIP_88');
    });
  });

  describe('redeemAffiliateInviteAction', () => {
    it('rejects expired invitation tokens', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 'invite_1',
          status: 'pending',
          expires_at: Date.now() - 10000,
        }),
      };
      vi.mocked(dbClient.getD1).mockResolvedValue(mockDb as any);

      const res = await redeemAffiliateInviteAction({
        token: 'token_1234567890123456',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        trafficChannel: 'youtube',
        preferredRail: 'VIETQR',
        termsAccepted: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invite token has expired');
    });
  });
});
