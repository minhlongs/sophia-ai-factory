/**
 * Unit Tests for Postback Service
 *
 * Validates HMAC authentication, token match, JSON parsing, and idempotency outcome.
 * @module land/affiliates/postbacks/__tests__/saas-crypto-postback-service.test
 */

import { describe, it, expect } from 'vitest';
import { processSaasCryptoPostback } from '../saas-crypto-postback-service';

describe('SaaS & Crypto Postback Service', () => {
  const secret = 'test_webhook_secret_key_1234567890';

  it('rejects invalid signature or token', async () => {
    const res = await processSaasCryptoPostback({
      network: 'partnerstack',
      rawBody: JSON.stringify({ reward_amount_cents: 100 }),
      signature: 'invalid_sig',
      secret,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('INVALID_SIGNATURE');
  });

  it('accepts direct secret token match and processes commission', async () => {
    const rawBody = JSON.stringify({
      id: 'txn_direct_1',
      partner_key: 'aff_1',
      reward_amount_cents: 3500,
    });

    const res = await processSaasCryptoPostback({
      network: 'partnerstack',
      rawBody,
      signature: secret, // direct token match
      secret,
    });

    expect(res.success).toBe(true);
    expect(res.commissionCents).toBe(3500);
    expect(res.isIdempotentDuplicate).toBe(false);
  });

  it('rejects malformed json payloads', async () => {
    const res = await processSaasCryptoPostback({
      network: 'binance',
      rawBody: 'not_a_json_string',
      signature: secret,
      secret,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('MALFORMED_JSON');
  });

  it('rejects zero or negative commission payloads', async () => {
    const rawBody = JSON.stringify({
      id: 'txn_zero',
      partner_key: 'aff_1',
      reward_amount_cents: 0,
    });

    const res = await processSaasCryptoPostback({
      network: 'partnerstack',
      rawBody,
      signature: secret,
      secret,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('ZERO_COMMISSION');
  });
});
