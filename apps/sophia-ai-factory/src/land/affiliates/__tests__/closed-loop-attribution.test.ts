/**
 * Unit Tests for Closed-Loop Attribution Subsystem
 *
 * Verifies tag injection, atomic D1 commission recording, and closed-loop conversion handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  injectCommerceAttribution,
  buildAttributedReferralUrl,
  generateAttributionToken,
} from '@/land/commerce/commerce-attribution-injector';
import { recordAtomicCommission } from '../atomic-commission-recorder';
import {
  resolveAttributionTouchpoint,
  processClosedLoopConversion,
} from '../closed-loop-attribution-engine';
import * as dbClient from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';

vi.mock('@/seed/db/client');
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_1'] }),
  },
}));

describe('Commerce Video Attribution Injector', () => {
  it('builds referral URLs with clean query parameters', () => {
    const urlWithoutSub = buildAttributedReferralUrl('VIP_ALEX');
    expect(urlWithoutSub).toBe('https://sophia.agencyos.network/r/VIP_ALEX');

    const urlWithSub = buildAttributedReferralUrl('VIP_ALEX', 'tiktok_bio');
    expect(urlWithSub).toBe('https://sophia.agencyos.network/r/VIP_ALEX?sub_id=tiktok_bio');
  });

  it('generates structured multi-platform metadata', () => {
    const meta = injectCommerceAttribution({
      partnerCode: 'CREATOR_99',
      campaignSubId: 'yt_shorts',
      productId: 'prod_4455667788',
      productTitle: 'AI Smart Mic',
      storeId: 'store_shopify_1',
    });

    expect(meta.attributionToken).toMatch(/^ATTR_CREATOR_99_yt_shorts_prod_445/);
    expect(meta.youtubeDescriptionBlock).toContain('AI Smart Mic');
    expect(meta.youtubeDescriptionBlock).toContain('CREATOR_99');
    expect(meta.tiktokCaptionSnippet).toContain('#partner');
    expect(meta.structuredTags).toContain('partner_CREATOR_99');
    expect(meta.structuredTags).toContain('sub_yt_shorts');
  });
});

describe('Atomic Commission Recorder & Closed-Loop Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records 20% commission atomically in D1 with 14-day hold', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'partner_1', commission_rate_pct: 20.0, status: 'active' }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    };
    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb as any);

    const res = await recordAtomicCommission({
      paymentProvider: 'nowpayments',
      paymentId: 'pay_998877',
      customerUserId: 'user_cust_1',
      grossAmountCents: 10000, // $100.00
      partnerCode: 'VIP_ALEX',
    });

    expect(res.success).toBe(true);
    expect(res.commissionCents).toBe(2000); // 20% of $100 = $20.00
    expect(res.alreadyRecorded).toBe(false);
  });

  it('handles idempotent webhook duplication gracefully', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'partner_1', commission_rate_pct: 20.0, status: 'active' }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }), // Conflict ignored
    };
    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb as any);

    const res = await recordAtomicCommission({
      paymentProvider: 'nowpayments',
      paymentId: 'pay_duplicate',
      customerUserId: 'user_cust_1',
      grossAmountCents: 5000,
      partnerCode: 'VIP_ALEX',
    });

    expect(res.success).toBe(true);
    expect(res.alreadyRecorded).toBe(true);
  });

  it('processes closed-loop conversions and dispatches Inngest event', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce({
          id: 'ref_1',
          partner_id: 'partner_1',
          partner_code: 'VIP_ALEX',
          created_at: Date.now() - 1000,
        })
        .mockResolvedValueOnce({ id: 'partner_1', commission_rate_pct: 20.0, status: 'active' }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    };
    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb as any);

    const result = await processClosedLoopConversion({
      paymentProvider: 'nowpayments',
      paymentId: 'pay_closed_loop_1',
      customerUserId: 'user_buyer',
      grossAmountCents: 15000,
      attributionToken: 'ATTR_TOKEN_1',
    });

    expect(result.success).toBe(true);
    expect(result.commissionCents).toBe(3000);
    expect(inngest.send).toHaveBeenCalled();
  });
});
