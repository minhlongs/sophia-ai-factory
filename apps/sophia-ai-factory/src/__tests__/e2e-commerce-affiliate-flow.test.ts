/**
 * End-to-End Integration Test: Autonomous E-Commerce Inngest, Video Attribution & Dual-Rail Settlement
 *
 * Verifies complete closed-loop lifecycle:
 * Catalog Sync -> Video Dispatch -> Attribution Tag Injection -> Webhook Commission -> Dual-Rail Settlement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { injectCommerceAttribution } from '@/land/commerce/commerce-attribution-injector';
import { processClosedLoopConversion } from '@/land/affiliates/closed-loop-attribution-engine';
import { requestDualRailPayoutAction } from '@/forest/actions/affiliate-payout-actions';
import * as authSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';

vi.mock('@/seed/auth/better-auth-session');
vi.mock('@/seed/db/client');
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_e2e_1'] }),
  },
}));
vi.mock('@/tree/crypto/encrypt-secret', () => ({
  encryptSecret: vi.fn(async (text: string) => `encrypted_${Buffer.from(text).toString('base64')}`),
}));

describe('E2E Commerce, Attribution & Affiliate Settlement Flow', () => {
  const partnerUser = { id: 'partner_usr_99', email: 'partner@creator.tv' };
  const partnerId = 'partner_record_99';
  const partnerCode = 'TOP_CREATOR';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(partnerUser as any);
  });

  it('executes full closed-loop pipeline from video metadata injection to payout settlement', async () => {
    // 1. Video Attribution Metadata Injection
    const videoMeta = injectCommerceAttribution({
      partnerCode,
      campaignSubId: 'spring_drop',
      productId: 'shopify_prod_888',
      productTitle: 'Pro Wireless RGB Lav Mic',
      storeId: 'store_us_1',
    });

    expect(videoMeta.attributionToken).toContain(`ATTR_${partnerCode}_spring_drop`);
    expect(videoMeta.referralUrl).toContain(`sub_id=spring_drop`);

    // 2. Conversion webhook arrives via NOWPayments
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        // Referral token lookup
        .mockResolvedValueOnce({
          id: 'ref_e2e_1',
          partner_id: partnerId,
          partner_code: partnerCode,
          created_at: Date.now() - 5000,
        })
        // Partner active check
        .mockResolvedValueOnce({
          id: partnerId,
          commission_rate_pct: 20.0,
          status: 'active',
        })
        // Partner check for payout request
        .mockResolvedValueOnce({
          id: partnerId,
          pending_payout_cents: 2000,
          settled_payout_cents: 0,
        })
        // Payable total sum check for payout request
        .mockResolvedValueOnce({
          payable_total: 10000,
        }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    };
    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb as any);

    const conversionResult = await processClosedLoopConversion({
      paymentProvider: 'nowpayments',
      paymentId: 'np_tx_887766',
      orderId: 'ORD-99221',
      customerUserId: 'buyer_usr_123',
      grossAmountCents: 10000, // $100.00
      attributionToken: videoMeta.attributionToken,
      subId: 'spring_drop',
    });

    expect(conversionResult.success).toBe(true);
    expect(conversionResult.commissionCents).toBe(2000); // 20% of $100 = $20.00
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'affiliate/conversion.recorded',
      })
    );

    // 3. Partner Requests Payout via VietQR (Domestic Vietnam NAPAS 247)
    const payoutResult = await requestDualRailPayoutAction({
      partnerId,
      rail: 'VIETQR',
      amountCents: 5000, // $50.00
      bankBin: '970422',
      bankAccountNumber: '0987654321',
      bankAccountName: 'NGUYEN VAN A',
    });

    expect(payoutResult.success).toBe(true);
    expect(payoutResult.payoutId).toMatch(/^payout_/);

    // 4. Partner Requests Alternate Settlement via USDT (TRC20)
    mockDb.first
      .mockResolvedValueOnce({ id: partnerId, pending_payout_cents: 0, settled_payout_cents: 5000 })
      .mockResolvedValueOnce({ payable_total: 10000 });

    const cryptoPayoutResult = await requestDualRailPayoutAction({
      partnerId,
      rail: 'USDT',
      amountCents: 6000, // $60.00
      usdtNetwork: 'TRC20',
      usdtAddress: 'TLyVbZ5t1h8yW3t2zC8mX2a9d6e4b1a3c7',
    });

    expect(cryptoPayoutResult.success).toBe(true);
    expect(cryptoPayoutResult.payoutId).toMatch(/^payout_/);
  });
});
