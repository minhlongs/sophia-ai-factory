/**
 * Unit tests for unified webhook signature (signature.ts).
 * Covers: sign/verify roundtrip, skew tolerance, bad-sig reject,
 * legacy bare-hex rejection (default=false since 2026-05-09),
 * explicit acceptLegacy:true backwards-compat path,
 * and verifyInboundWebhook for 3rd-party provider signatures.
 * @module lib/webhooks/__tests__/signature.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { signWebhook, verifyWebhook, verifyInboundWebhook, computeHmacHex, timingSafeEqual } from '../signature';

const SECRET = 'test-secret-12345';
const BODY = JSON.stringify({ event: 'mission.completed', tenantId: 'abc' });

afterEach(() => {
  vi.useRealTimers();
});

describe('signWebhook', () => {
  it('returns t=<ts>,v1=<hex> format', async () => {
    const sig = await signWebhook(BODY, SECRET);
    expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('uses provided timestamp', async () => {
    const ts = 1700000000;
    const sig = await signWebhook(BODY, SECRET, ts);
    expect(sig.startsWith(`t=${ts},`)).toBe(true);
  });

  it('produces different signatures for different secrets', async () => {
    const s1 = await signWebhook(BODY, 'secret-a');
    const s2 = await signWebhook(BODY, 'secret-b');
    expect(s1).not.toBe(s2);
  });

  it('produces different signatures for different bodies', async () => {
    const ts = 1700000000;
    const s1 = await signWebhook('{"a":1}', SECRET, ts);
    const s2 = await signWebhook('{"a":2}', SECRET, ts);
    expect(s1).not.toBe(s2);
  });
});

describe('verifyWebhook — new format', () => {
  it('roundtrip sign→verify returns true', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signWebhook(BODY, SECRET, ts);
    const ok = await verifyWebhook(BODY, sig, SECRET);
    expect(ok).toBe(true);
  });

  it('returns false for tampered body', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signWebhook(BODY, SECRET, ts);
    const ok = await verifyWebhook(BODY + ' ', sig, SECRET);
    expect(ok).toBe(false);
  });

  it('returns false for wrong secret', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signWebhook(BODY, SECRET, ts);
    const ok = await verifyWebhook(BODY, sig, 'wrong-secret');
    expect(ok).toBe(false);
  });

  it('returns false when signature is older than tolerance', async () => {
    const staleTs = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const sig = await signWebhook(BODY, SECRET, staleTs);
    const ok = await verifyWebhook(BODY, sig, SECRET, { toleranceSec: 300 });
    expect(ok).toBe(false);
  });

  it('accepts signature within tolerance window', async () => {
    const ts = Math.floor(Date.now() / 1000) - 60; // 1 min ago
    const sig = await signWebhook(BODY, SECRET, ts);
    const ok = await verifyWebhook(BODY, sig, SECRET, { toleranceSec: 300 });
    expect(ok).toBe(true);
  });

  it('returns false for malformed header', async () => {
    const ok = await verifyWebhook(BODY, 'garbage', SECRET);
    expect(ok).toBe(false);
  });
});

describe('verifyWebhook — legacy bare-hex compat', () => {
  /** Produce a legacy bare-hex signature (old signer.sign() format) */
  async function legacySign(body: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Default is now false — legacy rejected unless caller opts in explicitly.
  it('rejects legacy bare-hex by default (acceptLegacy=false since 2026-05-09)', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY, legacySig, SECRET);
    expect(ok).toBe(false);
  });

  it('accepts legacy bare-hex when caller passes acceptLegacy:true explicitly', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY, legacySig, SECRET, { acceptLegacy: true });
    expect(ok).toBe(true);
  });

  it('rejects legacy bare-hex with explicit acceptLegacy=false', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY, legacySig, SECRET, { acceptLegacy: false });
    expect(ok).toBe(false);
  });

  it('rejects tampered body even with acceptLegacy:true', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY + ' ', legacySig, SECRET, { acceptLegacy: true });
    expect(ok).toBe(false);
  });
});

// ── verifyInboundWebhook — 3rd-party provider signatures ────────────────────

describe('verifyInboundWebhook — SHA-256 raw body', () => {
  const secret = 'inbound-secret-256';

  it('accepts valid SHA-256 signature over raw body', async () => {
    const body = '{"amount":100,"currency":"VND"}';
    const sig = await computeHmacHex(body, secret, 'SHA-256');
    const ok = await verifyInboundWebhook(body, sig, secret, { algo: 'SHA-256' });
    expect(ok).toBe(true);
  });

  it('rejects tampered body', async () => {
    const body = '{"amount":100}';
    const sig = await computeHmacHex(body, secret, 'SHA-256');
    const ok = await verifyInboundWebhook('{"amount":999}', sig, secret, { algo: 'SHA-256' });
    expect(ok).toBe(false);
  });

  it('rejects wrong secret', async () => {
    const body = '{"event":"payment"}';
    const sig = await computeHmacHex(body, secret, 'SHA-256');
    const ok = await verifyInboundWebhook(body, sig, 'wrong-secret', { algo: 'SHA-256' });
    expect(ok).toBe(false);
  });
});

describe('verifyInboundWebhook — SHA-512 with canonicalization', () => {
  const secret = 'inbound-secret-512';

  function nowPaymentsCanonicalize(rawBody: string): string {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return JSON.stringify(parsed, Object.keys(parsed).sort());
  }

  it('accepts valid SHA-512 signature over canonicalized body', async () => {
    const rawBody = JSON.stringify({ z: 3, a: 1, m: 2 });
    const canonical = nowPaymentsCanonicalize(rawBody);
    const sig = await computeHmacHex(canonical, secret, 'SHA-512');
    const ok = await verifyInboundWebhook(rawBody, sig, secret, {
      algo: 'SHA-512',
      canonicalize: nowPaymentsCanonicalize,
    });
    expect(ok).toBe(true);
  });

  it('rejects tampered body with SHA-512', async () => {
    const rawBody = JSON.stringify({ payment_id: '123', status: 'finished' });
    const canonical = nowPaymentsCanonicalize(rawBody);
    const sig = await computeHmacHex(canonical, secret, 'SHA-512');
    const tampered = JSON.stringify({ payment_id: '999', status: 'finished' });
    const ok = await verifyInboundWebhook(tampered, sig, secret, {
      algo: 'SHA-512',
      canonicalize: nowPaymentsCanonicalize,
    });
    expect(ok).toBe(false);
  });

  it('is order-agnostic via canonicalization (different key order same result)', async () => {
    const body1 = JSON.stringify({ b: 2, a: 1 });
    const body2 = JSON.stringify({ a: 1, b: 2 });
    const canonical = nowPaymentsCanonicalize(body1);
    const sig = await computeHmacHex(canonical, secret, 'SHA-512');
    // body2 has same data, different order — canonicalize must normalize it
    const ok = await verifyInboundWebhook(body2, sig, secret, {
      algo: 'SHA-512',
      canonicalize: nowPaymentsCanonicalize,
    });
    expect(ok).toBe(true);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('returns false for same-length different content', () => {
    expect(timingSafeEqual('abc', 'xyz')).toBe(false);
  });
});
