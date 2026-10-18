import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/land/payments/payos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/payments/payos')>();
  return { ...actual, FEATURE_PAYOS: true };
});

import { payOsCanonicalize } from '@/land/payments/payos';
import { verifyPayOsRequest } from './payos-verifier';

const CHECKSUM_KEY = 'test-payos-checksum-key';

const payload = {
  code: '00',
  desc: 'success',
  success: true,
  data: {
    orderCode: 123456,
    amount: 4975000,
    description: 'Sophia BASIC',
    paymentLinkId: 'payos-link-123',
    code: '00',
    desc: 'success',
    accountNumber: null,
    reference: null,
    counterAccountBankId: null,
  },
  signature: 'placeholder',
};

async function signPayload(): Promise<string> {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CHECKSUM_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payOsCanonicalize(body)),
  );
  return Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, '0')).join('');
}

function makeRequest(body: string): NextRequest {
  return new NextRequest('https://sophia.test/api/webhooks/payos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('verifyPayOsRequest', () => {
  it('accepts the official body signature without requiring an x-checksum header', async () => {
    payload.signature = await signPayload();
    const result = await verifyPayOsRequest(makeRequest(JSON.stringify(payload)), CHECKSUM_KEY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ipn.signature).toBe(payload.signature);
      expect(result.data.ipn.data.paymentLinkId).toBe('payos-link-123');
    }
  });

  it('rejects a tampered official payload signature', async () => {
    payload.signature = await signPayload();
    const tampered = { ...payload, data: { ...payload.data, amount: 1 } };
    const result = await verifyPayOsRequest(makeRequest(JSON.stringify(tampered)), CHECKSUM_KEY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toMatchObject({ error: 'Invalid signature' });
    }
  });

  it('canonicalizes null optional data fields as empty strings', () => {
    const body = JSON.stringify({ data: { accountNumber: null, code: '00' } });
    expect(payOsCanonicalize(body)).toBe('accountNumber=&code=00');
  });
});
