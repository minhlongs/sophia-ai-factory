import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature, WEBHOOK_HEADERS } from '@/lib/raas/webhook-hmac';

describe('Webhook HMAC', () => {
  const secret = 'test-webhook-secret-123';
  const payload = JSON.stringify({ event: 'mission.completed', mission_id: 'msn_001' });

  it('signs and verifies a payload successfully', () => {
    const { signature } = signPayload(payload, secret);
    expect(signature).toContain('t=');
    expect(signature).toContain('v1=');

    const valid = verifySignature(payload, signature, secret);
    expect(valid).toBe(true);
  });

  it('rejects tampered payload', () => {
    const { signature } = signPayload(payload, secret);
    const tampered = payload.replace('msn_001', 'msn_999');
    const valid = verifySignature(tampered, signature, secret);
    expect(valid).toBe(false);
  });

  it('rejects wrong secret', () => {
    const { signature } = signPayload(payload, secret);
    const valid = verifySignature(payload, signature, 'wrong-secret');
    expect(valid).toBe(false);
  });

  it('rejects malformed signature', () => {
    expect(verifySignature(payload, 'invalid', secret)).toBe(false);
    expect(verifySignature(payload, 't=123', secret)).toBe(false);
    expect(verifySignature(payload, 'v1=abc', secret)).toBe(false);
  });

  it('exports correct header names', () => {
    expect(WEBHOOK_HEADERS.signature).toBe('x-webhook-signature');
    expect(WEBHOOK_HEADERS.timestamp).toBe('x-webhook-timestamp');
  });
});
