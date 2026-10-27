/**
 * Unit Tests for Postback Service (Domain B: 100% Workspace Revenue)
 *
 * Validates HMAC authentication, timing-safe payload validation, 100% workspace revenue attribution,
 * real SQLite D1 persistence, retry idempotency, and state progression.
 * @module land/affiliates/postbacks/__tests__/saas-crypto-postback-service.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { processSaasCryptoPostback } from '../saas-crypto-postback-service';
import { computeHmacSha256Hex } from '@/land/postback/hmac-verifier';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

// Exercise the REAL migration chain instead of an inline copy of the schema.
function createPostbackTestD1() {
  const prior = readFileSync(resolve(process.cwd(), 'migrations/0206_commission_events.sql'), 'utf8');
  const upgrade = readFileSync(
    resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
    'utf8',
  );
  return createFakeD1([prior, upgrade]);
}

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

  it('accepts valid HMAC payload signature and attributes 100% commission to workspace (0% platform fee)', async () => {
    const fakeDb = createPostbackTestD1();
    const rawBody = JSON.stringify({
      id: 'txn_direct_1',
      partner_key: 'aff_1',
      reward_amount_cents: 3500,
      currency: 'usd',
    });
    const signature = await computeHmacSha256Hex(secret, rawBody);

    const res = await processSaasCryptoPostback({
      db: fakeDb as unknown as D1Database,
      tenantId: 'ws_test_tenant',
      network: 'partnerstack',
      rawBody,
      signature,
      secret,
    });

    expect(res.success).toBe(true);
    expect(res.commissionCents).toBe(3500);
    expect(res.platformFeeCents).toBe(0);
    expect(res.isIdempotentDuplicate).toBe(false);

    // Verify row persisted in workspace_external_commissions
    const row = await fakeDb
      .prepare('SELECT * FROM workspace_external_commissions WHERE tenant_id = ?')
      .bind('ws_test_tenant')
      .first<{
        tenant_id: string;
        network: string;
        commission_cents: number;
        platform_fee_cents: number;
        status: string;
      }>();

    expect(row).not.toBeNull();
    expect(row?.tenant_id).toBe('ws_test_tenant');
    expect(row?.commission_cents).toBe(3500);
    expect(row?.platform_fee_cents).toBe(0);
    expect(row?.status).toBe('approved');
  });

  it('supports retry idempotency and state progression (pending -> approved -> reversed)', async () => {
    const fakeDb = createPostbackTestD1();
    const db = fakeDb as unknown as D1Database;

    // 1. First event: pending
    const bodyPending = JSON.stringify({ order_id: 'cex_tx_999', affiliate_code: 'aff_cex', rebate_amount: 10.0, coin: 'USDT', status: 'pending' });
    const sigPending = await computeHmacSha256Hex(secret, bodyPending);
    const resPending = await processSaasCryptoPostback({ db, tenantId: 'tenant_cex', network: 'bybit', rawBody: bodyPending, signature: sigPending, secret });
    expect(resPending.success).toBe(true);
    expect(resPending.isIdempotentDuplicate).toBe(false);

    // 2. Retry of pending event: must be idempotent duplicate without failure
    const retryPending = await processSaasCryptoPostback({ db, tenantId: 'tenant_cex', network: 'bybit', rawBody: bodyPending, signature: sigPending, secret });
    expect(retryPending.success).toBe(true);
    expect(retryPending.isIdempotentDuplicate).toBe(true);

    // 3. State transition: approved (different status) must NOT be skipped as duplicate
    const bodyApproved = JSON.stringify({ order_id: 'cex_tx_999', affiliate_code: 'aff_cex', rebate_amount: 10.0, coin: 'USDT', status: 'approved' });
    const sigApproved = await computeHmacSha256Hex(secret, bodyApproved);
    const resApproved = await processSaasCryptoPostback({ db, tenantId: 'tenant_cex', network: 'bybit', rawBody: bodyApproved, signature: sigApproved, secret });
    expect(resApproved.success).toBe(true);
    expect(resApproved.isIdempotentDuplicate).toBe(false);

    // Check that two distinct rows exist in workspace_external_commissions
    const countRows = await fakeDb.prepare('SELECT COUNT(*) as cnt FROM workspace_external_commissions WHERE tenant_id = ?').bind('tenant_cex').first<{ cnt: number }>();
    expect(countRows?.cnt).toBe(2);

    // 4. Reversed event with negative commission must record Math.abs and status 'reversed'
    const bodyReversed = JSON.stringify({ order_id: 'cex_tx_999', affiliate_code: 'aff_cex', rebate_amount: -10.0, coin: 'USDT', status: 'reversed' });
    const sigReversed = await computeHmacSha256Hex(secret, bodyReversed);
    const resReversed = await processSaasCryptoPostback({ db, tenantId: 'tenant_cex', network: 'bybit', rawBody: bodyReversed, signature: sigReversed, secret });
    expect(resReversed.success).toBe(true);
    expect(resReversed.commissionCents).toBe(1000);
  });

  it('rejects malformed json payloads when signature matches', async () => {
    const rawBody = 'not_a_json_string';
    const signature = await computeHmacSha256Hex(secret, rawBody);

    const res = await processSaasCryptoPostback({
      network: 'binance',
      rawBody,
      signature,
      secret,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('MALFORMED_JSON');
  });

  it('rejects zero or negative commission payloads when signature matches', async () => {
    const rawBody = JSON.stringify({
      id: 'txn_zero',
      partner_key: 'aff_1',
      reward_amount_cents: 0,
    });
    const signature = await computeHmacSha256Hex(secret, rawBody);

    const res = await processSaasCryptoPostback({
      network: 'partnerstack',
      rawBody,
      signature,
      secret,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('ZERO_COMMISSION');
  });
});
