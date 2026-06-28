/**
 * Unit tests for HMAC-SHA256 webhook signer.
 * @module lib/webhooks/__tests__/signer.test
 */

import { describe, it, expect } from 'vitest';
import { sign, verify } from '../signer';

describe('signer', () => {
  it('produces a 64-char hex HMAC-SHA256 string', async () => {
    const sig = await sign('my-secret', '{"hello":"world"}');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces identical signatures for same inputs', async () => {
    const body = JSON.stringify({ event: 'test', data: 42 });
    const sig1 = await sign('secret-key', body);
    const sig2 = await sign('secret-key', body);
    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different secrets', async () => {
    const body = '{"test":true}';
    const sig1 = await sign('secret-a', body);
    const sig2 = await sign('secret-b', body);
    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different bodies', async () => {
    const secret = 'same-secret';
    const sig1 = await sign(secret, '{"a":1}');
    const sig2 = await sign(secret, '{"a":2}');
    expect(sig1).not.toBe(sig2);
  });

  it('verify returns true for correct signature', async () => {
    const body = '{"event":"mission.completed"}';
    const secret = 'test-verify-secret';
    const sig = await sign(secret, body);
    const valid = await verify(secret, body, sig);
    expect(valid).toBe(true);
  });

  it('verify returns false for tampered body', async () => {
    const body = '{"event":"mission.completed"}';
    const secret = 'test-verify-secret';
    const sig = await sign(secret, body);
    const valid = await verify(secret, '{"event":"tampered"}', sig);
    expect(valid).toBe(false);
  });

  it('verify returns false for wrong secret', async () => {
    const body = '{"event":"test"}';
    const sig = await sign('correct-secret', body);
    const valid = await verify('wrong-secret', body, sig);
    expect(valid).toBe(false);
  });
});
