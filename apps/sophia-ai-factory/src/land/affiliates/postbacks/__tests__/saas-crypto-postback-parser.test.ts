/**
 * Unit Tests for Postback Parser
 *
 * Validates normalization of diverse SaaS & Crypto affiliate webhook payloads.
 * @module land/affiliates/postbacks/__tests__/saas-crypto-postback-parser.test
 */

import { describe, it, expect } from 'vitest';
import { parseSaasCryptoPostback } from '../saas-crypto-postback-parser';

describe('SaaS & Crypto Postback Parser', () => {
  it('correctly normalizes PartnerStack commission events', () => {
    const payload = {
      id: 'evt_ps_123',
      partner_key: 'aff_abc',
      reward_amount_cents: 2500,
      currency: 'usd',
    };
    const event = parseSaasCryptoPostback('partnerstack', payload, 1728394000);
    expect(event.eventId).toContain('partnerstack_evt_ps_123');
    expect(event.commissionCents).toBe(2500);
    expect(event.network).toBe('partnerstack');
    expect(event.eventType).toBe('commission_approved');
  });

  it('correctly normalizes Rewardful subscription events', () => {
    const payload = {
      conversion: { id: 'conv_456', sub_id: 'campaign_x' },
      commission: { amount_cents: 1500, currency: 'USD' },
      affiliate: { token: 'rw_xyz' },
    };
    const event = parseSaasCryptoPostback('rewardful', payload, 1728394000);
    expect(event.eventId).toContain('rewardful_conv_456');
    expect(event.commissionCents).toBe(1500);
    expect(event.subId).toBe('campaign_x');
    expect(event.network).toBe('rewardful');
  });

  it('correctly normalizes Binance rebate telemetry', () => {
    const payload = {
      tradeId: 'tid_789',
      referralId: 'bin_999',
      rebateUsd: 5.75,
      tradeVolumeUsd: 5000,
    };
    const event = parseSaasCryptoPostback('binance', payload, 1728394000);
    expect(event.eventId).toContain('binance_tid_789');
    expect(event.commissionCents).toBe(575);
    expect(event.grossAmountCents).toBe(500000);
    expect(event.eventType).toBe('trading_rebate');
  });

  it('correctly normalizes Bybit trading rebates', () => {
    const payload = {
      order_id: 'oid_000',
      affiliate_code: 'byb_555',
      rebate_amount: 1.25,
      coin: 'USDT',
    };
    const event = parseSaasCryptoPostback('bybit', payload, 1728394000);
    expect(event.eventId).toContain('bybit_oid_000');
    expect(event.commissionCents).toBe(125);
    expect(event.currency).toBe('USDT');
    expect(event.network).toBe('bybit');
  });
});
