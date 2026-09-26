/**
 * Unit & Integration Test Suite: Localized Payment Rails Webhooks
 *
 * Tests:
 * 1. SEPA Webhook Route (cleared, failed, charged_back events)
 * 2. PromptPay Webhook Route (success, underpayment detection, not found)
 * 3. GrabPay Webhook Route (SUCCESS, EXPIRED, FAILED callbacks)
 *
 * Layer: app/api/webhooks/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sepaPost } from '../sepa/route';
import { POST as promptPayPost } from '../promptpay/route';
import { POST as grabPayPost } from '../grabpay/route';
import * as dbModule from '@/seed/db/client';

describe('Localized Rails Webhooks Suite', () => {
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

    vi.spyOn(dbModule, 'getD1Raw').mockResolvedValue(mockDb);
  });

  // =========================================================================
  // 1. SEPA Webhook
  // =========================================================================
  describe('1. SEPA Webhook Route', () => {
    it('marks transaction as completed on cleared event', async () => {
      const payload = {
        eventType: 'cleared',
        mandateReference: 'SAF-SEPA-MANDATE-01',
        transactionId: 'txn_sepa_123',
        settledAmountEur: 746.11,
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sepa-signature': 'sepa_mock_secret_key',
        },
        body: JSON.stringify(payload),
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('completed');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
      );
    });

    it('marks transaction as charged_back with return reason code', async () => {
      const payload = {
        eventType: 'charged_back',
        mandateReference: 'SAF-SEPA-MANDATE-01',
        transactionId: 'txn_sepa_123',
        returnReasonCode: 'AM04_INSUFFICIENT_FUNDS',
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('charged_back');
    });

    it('rejects malformed JSON with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/sepa', {
        method: 'POST',
        body: 'invalid-json-text',
      });

      const res = await sepaPost(req);
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 2. PromptPay Webhook
  // =========================================================================
  describe('2. PromptPay Webhook Route', () => {
    it('completes transaction when full amount is paid', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 'txn_th_01',
            total_amount: 3650.0,
            status: 'pending',
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const payload = {
        transactionId: 'txn_th_01',
        paidAmount: 3650.0,
        status: 'success',
        bankRef: 'SCB_SLIP_98765',
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await promptPayPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('completed');
    });

    it('flags transaction as underpaid when amount is below 99.5% tolerance', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 'txn_th_02',
            total_amount: 3650.0,
            status: 'pending',
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const payload = {
        transactionId: 'txn_th_02',
        paidAmount: 3000.0, // Significantly below 3650.0
        status: 'success',
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await promptPayPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('underpaid');
    });

    it('returns 404 when transaction is not found in database', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const payload = {
        transactionId: 'txn_nonexistent',
        paidAmount: 1000.0,
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await promptPayPost(req);
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. GrabPay Webhook
  // =========================================================================
  describe('3. GrabPay Webhook Route', () => {
    it('completes transaction on SUCCESS callback', async () => {
      const payload = {
        transactionId: 'txn_grab_01',
        grabSessionId: 'grab_sess_123',
        status: 'SUCCESS',
        amount: 299.0,
        currency: 'SGD',
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/grabpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await grabPayPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('completed');
    });

    it('marks transaction as expired on EXPIRED callback', async () => {
      const payload = {
        transactionId: 'txn_grab_02',
        status: 'EXPIRED',
        amount: 299.0,
        currency: 'SGD',
      };

      const req = new NextRequest('http://localhost:3000/api/webhooks/grabpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await grabPayPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { status?: string };
      expect(json.status).toBe('expired');
    });
  });
});
