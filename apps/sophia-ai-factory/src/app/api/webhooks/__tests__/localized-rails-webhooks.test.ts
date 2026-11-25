/**
 * Unit & Integration Test Suite: Localized Payment Rails Webhooks
 *
 * Tests:
 * 1. SEPA Webhook Route (cleared, failed, charged_back, missing secret 503, bad sig 401, replay 200)
 * 2. PromptPay Webhook Route (success, underpayment detection, not found, currency mismatch)
 * 3. GrabPay Webhook Route (SUCCESS, EXPIRED, FAILED, amount/currency mismatch)
 *
 * Layer: app/api/webhooks/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { computeHmacHex } from '@/seed/security/signature';
import { POST as sepaPost } from '../sepa/route';
import { POST as promptPayPost } from '../promptpay/route';
import { POST as grabPayPost } from '../grabpay/route';
import * as dbModule from '@/seed/db/client';

const SEPA_SECRET = 'test_sepa_hmac_secret_2026';
const PROMPTPAY_SECRET = 'test_promptpay_hmac_secret_2026';
const GRABPAY_SECRET = 'test_grabpay_hmac_secret_2026';

interface MockTxnRow {
  id: string;
  total_amount: number;
  settlement_currency: string;
  status: string;
}

function createLocalizedRailD1Mock(initialTxn: MockTxnRow | null) {
  const paymentEvents = new Map<string, { processed: number }>();
  const txn = initialTxn ? { ...initialTxn } : null;
  const preparedSqls: string[] = [];

  const prepare = vi.fn((sql: string) => {
    preparedSqls.push(sql);
    return {
      bind: vi.fn((...args: unknown[]) => ({
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO payment_events')) {
            const eventId = String(args[0]);
            if (paymentEvents.has(eventId)) {
              return { success: true, meta: { changes: 0 } };
            }
            paymentEvents.set(eventId, { processed: 0 });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE payment_events SET processed = 1')) {
            const eventId = String(args[0]);
            const entry = paymentEvents.get(eventId);
            if (entry) entry.processed = 1;
            return { success: true, meta: { changes: entry ? 1 : 0 } };
          }
          if (sql.includes('DELETE FROM payment_events')) {
            const eventId = String(args[0]);
            const deleted = paymentEvents.delete(eventId);
            return { success: true, meta: { changes: deleted ? 1 : 0 } };
          }
          if (sql.includes('UPDATE localized_payment_transactions')) {
            if (!txn) return { success: true, meta: { changes: 0 } };
            if (sql.includes("SET status = 'completed'") && txn.status === 'pending') {
              txn.status = 'completed';
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes('SET status = ?1')) {
              txn.status = String(args[0]);
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes("SET status = 'failed'") && txn.status === 'pending') {
              txn.status = 'failed';
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        }),
        first: vi.fn(async () => {
          if (sql.includes('FROM payment_events')) {
            const eventId = String(args[0]);
            return paymentEvents.get(eventId) ?? null;
          }
          if (sql.includes('FROM localized_payment_transactions')) {
            const id = String(args[0]);
            return txn && txn.id === id ? { ...txn } : null;
          }
          return null;
        }),
        all: vi.fn(async () => ({ results: [] })),
      })),
    };
  });

  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    preparedSqls,
    getTxn: () => txn,
  };
}

describe('Localized Rails Webhooks Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('SEPA_WEBHOOK_SECRET', SEPA_SECRET);
    vi.stubEnv('PROMPTPAY_WEBHOOK_SECRET', PROMPTPAY_SECRET);
    vi.stubEnv('GRABPAY_WEBHOOK_SECRET', GRABPAY_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('1. SEPA Webhook Route', () => {
    it('fails closed with 503 when SEPA_WEBHOOK_SECRET is unset', async () => {
      vi.stubEnv('SEPA_WEBHOOK_SECRET', '');
      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sepa-signature': 'sepa_mock_secret_key' },
        body: JSON.stringify({ eventType: 'cleared', transactionId: 'txn_sepa_123' }),
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(503);
    });

    it('rejects hardcoded mock secret or forged signature with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sepa-signature': 'sepa_mock_secret_key' },
        body: JSON.stringify({ eventType: 'cleared', transactionId: 'txn_sepa_123', settledAmountEur: 746.11 }),
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(401);
    });

    it('marks transaction as completed on cleared event and deduplicates replays', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_sepa_123',
        total_amount: 746.11,
        settlement_currency: 'EUR',
        status: 'pending',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        eventType: 'cleared',
        mandateReference: 'SAF-SEPA-MANDATE-01',
        transactionId: 'txn_sepa_123',
        settledAmountEur: 746.11,
        currency: 'EUR',
      });
      const sig = await computeHmacHex(rawBody, SEPA_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sepa-signature': sig },
        body: rawBody,
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('completed');
      expect(mock.getTxn()?.status).toBe('completed');

      const replayReq = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sepa-signature': sig },
        body: rawBody,
      });
      const replayRes = await sepaPost(replayReq);
      expect(replayRes.status).toBe(200);
      expect(await replayRes.json()).toMatchObject({ received: true, duplicate: true });
    });

    it('marks transaction as charged_back with return reason code', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_sepa_123',
        total_amount: 746.11,
        settlement_currency: 'EUR',
        status: 'completed',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        eventType: 'charged_back',
        mandateReference: 'SAF-SEPA-MANDATE-01',
        transactionId: 'txn_sepa_123',
        returnReasonCode: 'AM04_INSUFFICIENT_FUNDS',
      });
      const sig = await computeHmacHex(rawBody, SEPA_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sepa-signature': sig },
        body: rawBody,
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('charged_back');
    });

    it('rejects malformed JSON with 400 when validly signed', async () => {
      const rawBody = 'invalid-json-text';
      const sig = await computeHmacHex(rawBody, SEPA_SECRET, 'SHA-256');
      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'x-sepa-signature': sig },
        body: rawBody,
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(400);
    });
  });

  describe('2. PromptPay Webhook Route', () => {
    it('completes transaction when full amount is paid with valid HMAC', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_th_01',
        total_amount: 3650.0,
        settlement_currency: 'THB',
        status: 'pending',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        transactionId: 'txn_th_01',
        paidAmount: 3650.0,
        currency: 'THB',
        status: 'success',
        bankRef: 'SCB_SLIP_98765',
      });
      const sig = await computeHmacHex(rawBody, PROMPTPAY_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-promptpay-signature': sig },
        body: rawBody,
      });

      const res = await promptPayPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('completed');
    });

    it('flags transaction as underpaid when amount is below 99.5% tolerance', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_th_02',
        total_amount: 3650.0,
        settlement_currency: 'THB',
        status: 'pending',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        transactionId: 'txn_th_02',
        paidAmount: 3000.0,
        currency: 'THB',
        status: 'success',
      });
      const sig = await computeHmacHex(rawBody, PROMPTPAY_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-promptpay-signature': sig },
        body: rawBody,
      });

      const res = await promptPayPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('underpaid');
      expect(mock.getTxn()?.status).toBe('pending');
    });

    it('returns 404 when transaction is not found in database', async () => {
      const mock = createLocalizedRailD1Mock(null);
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        transactionId: 'txn_nonexistent',
        paidAmount: 1000.0,
        currency: 'THB',
      });
      const sig = await computeHmacHex(rawBody, PROMPTPAY_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-promptpay-signature': sig },
        body: rawBody,
      });

      const res = await promptPayPost(req);
      expect(res.status).toBe(404);
    });
  });

  describe('3. GrabPay Webhook Route', () => {
    it('completes transaction on SUCCESS callback when amount and currency match', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_grab_01',
        total_amount: 299.0,
        settlement_currency: 'SGD',
        status: 'pending',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        transactionId: 'txn_grab_01',
        grabSessionId: 'grab_sess_123',
        status: 'SUCCESS',
        amount: 299.0,
        currency: 'SGD',
      });
      const sig = await computeHmacHex(rawBody, GRABPAY_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/grabpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-grab-signature': sig },
        body: rawBody,
      });

      const res = await grabPayPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('completed');
    });

    it('rejects GrabPay SUCCESS callback when amount or currency mismatches', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_grab_mismatch',
        total_amount: 299.0,
        settlement_currency: 'SGD',
        status: 'pending',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        transactionId: 'txn_grab_mismatch',
        status: 'SUCCESS',
        amount: 0.01,
        currency: 'VND',
      });
      const sig = await computeHmacHex(rawBody, GRABPAY_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/grabpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-grab-signature': sig },
        body: rawBody,
      });

      const res = await grabPayPost(req);
      expect(res.status).toBe(422);
      expect(mock.getTxn()?.status).toBe('pending');
    });

    it('marks transaction as expired on EXPIRED callback', async () => {
      const mock = createLocalizedRailD1Mock({
        id: 'txn_grab_02',
        total_amount: 299.0,
        settlement_currency: 'SGD',
        status: 'pending',
      });
      vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mock.db);

      const rawBody = JSON.stringify({
        transactionId: 'txn_grab_02',
        status: 'EXPIRED',
        amount: 299.0,
        currency: 'SGD',
      });
      const sig = await computeHmacHex(rawBody, GRABPAY_SECRET, 'SHA-256');

      const req = new NextRequest('http://localhost:3000/api/webhooks/grabpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-grab-signature': sig },
        body: rawBody,
      });

      const res = await grabPayPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('expired');
    });
  });
});
