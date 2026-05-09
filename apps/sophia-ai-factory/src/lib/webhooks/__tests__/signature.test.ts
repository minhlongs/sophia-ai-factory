/**
 * Unit tests for unified webhook signature (signature.ts).
 * Covers: sign/verify roundtrip, skew tolerance, bad-sig reject,
 * legacy bare-hex compat, and backwards-compat opt-out.
 * @module lib/webhooks/__tests__/signature.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { signWebhook, verifyWebhook } from '../signature';

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

  it('accepts legacy bare-hex with acceptLegacy=true (default)', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY, legacySig, SECRET);
    expect(ok).toBe(true);
  });

  it('rejects legacy bare-hex with acceptLegacy=false', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY, legacySig, SECRET, { acceptLegacy: false });
    expect(ok).toBe(false);
  });

  it('rejects tampered body in legacy mode', async () => {
    const legacySig = await legacySign(BODY, SECRET);
    const ok = await verifyWebhook(BODY + ' ', legacySig, SECRET);
    expect(ok).toBe(false);
  });
});
