/**
 * Unit Tests for Postback Parser
 *
 * Validates normalization of diverse SaaS & Crypto affiliate webhook payloads,
 * zero fabricated gross multipliers, and distinct transaction vs event identity.
 * @module land/affiliates/postbacks/__tests__/saas-crypto-postback-parser.test
 */

import { describe, it, expect } from 'vitest';
import { parseSaasCryptoPostback } from '../saas-crypto-postback-parser';

describe('SaaS & Crypto Postback Parser', () => {
  it('correctly normalizes PartnerStack commission events with 0 gross when omitted', () => {
    const payload = {
      id: 'evt_ps_123',
      partner_key: 'aff_abc',
      reward_amount_cents: 2500,
      currency: 'usd',
    };
    const event = parseSaasCryptoPostback('partnerstack', payload, 1728394000);
    expect(event.externalTxnId).toBe('evt_ps_123');
    expect(event.eventId).toBe('partnerstack_evt_ps_123_approved');
    expect(event.commissionCents).toBe(2500);
    expect(event.grossAmountCents).toBe(0); // No speculative multiplier
    expect(event.network).toBe('partnerstack');
    expect(event.eventType).toBe('commission_approved');
    expect(event.reconciliationStatus).toBe('approved');
  });

  it('correctly normalizes Rewardful subscription events with distinct status eventId', () => {
    const payload = {
      conversion: { id: 'conv_456', sub_id: 'campaign_x' },
      commission: { amount_cents: 1500, currency: 'USD', state: 'pending' },
      affiliate: { token: 'rw_xyz' },
    };
    const event = parseSaasCryptoPostback('rewardful', payload, 1728394000);
    expect(event.externalTxnId).toBe('conv_456');
    expect(event.eventId).toBe('rewardful_conv_456_pending');
    expect(event.commissionCents).toBe(1500);
    expect(event.grossAmountCents).toBe(0); // No speculative multiplier
    expect(event.subId).toBe('campaign_x');
    expect(event.network).toBe('rewardful');
    expect(event.reconciliationStatus).toBe('pending');
  });

  it('correctly normalizes Binance rebate telemetry with explicit tradeVolumeUsd', () => {
    const payload = {
      tradeId: 'tid_789',
      referralId: 'bin_999',
      rebateUsd: 5.75,
      tradeVolumeUsd: 5000,
    };
    const event = parseSaasCryptoPostback('binance', payload, 1728394000);
    expect(event.externalTxnId).toBe('tid_789');
    expect(event.eventId).toBe('binance_tid_789_approved');
    expect(event.commissionCents).toBe(575);
    expect(event.grossAmountCents).toBe(500000);
    expect(event.eventType).toBe('trading_rebate');
    expect(event.reconciliationStatus).toBe('approved');
  });

  it('correctly normalizes Bybit trading rebates and reversals with 0 gross when volume omitted', () => {
    const payload = {
      order_id: 'oid_000',
      affiliate_code: 'byb_555',
      rebate_amount: 1.25,
      coin: 'USDT',
      status: 'reversed',
    };
    const event = parseSaasCryptoPostback('bybit', payload, 1728394000);
    expect(event.externalTxnId).toBe('oid_000');
    expect(event.eventId).toBe('bybit_oid_000_reversed');
    expect(event.commissionCents).toBe(125);
    expect(event.grossAmountCents).toBe(0); // No speculative 500x multiplier
    expect(event.currency).toBe('USDT');
    expect(event.network).toBe('bybit');
    expect(event.eventType).toBe('refund');
    expect(event.reconciliationStatus).toBe('reversed');
  });
});
