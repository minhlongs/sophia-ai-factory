import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeProviderApiKey } from './provider-probe';

describe('provider-probe', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('masks sensitive key bytes in the probe result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await probeProviderApiKey('openrouter', 'sk-or-v1-abcdef1234567890');
    expect(result.maskedKey).toBe('****...7890');
    expect(result.valid).toBe(true);
    expect(result.status).toBe('ACTIVE');
  });

  it('classifies HTTP 401/403 as invalid credentials', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await probeProviderApiKey('elevenlabs', 'invalid-eleven-key-1234');
    expect(result.valid).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.httpStatus).toBe(401);
    expect(result.message).toContain('Invalid API key');
  });

  it('classifies network timeouts as PROVIDER_UNAVAILABLE', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('TimeoutError: request timed out'));

    const result = await probeProviderApiKey('anthropic', 'sk-ant-test-key-1234');
    expect(result.valid).toBe(false);
    expect(result.status).toBe('PROVIDER_UNAVAILABLE');
    expect(result.httpStatus).toBe(504);
  });

  it('returns UNKNOWN for unsupported providers', async () => {
    const result = await probeProviderApiKey('unsupported-llm', 'sk-key-1234');
    expect(result.valid).toBe(false);
    expect(result.status).toBe('UNKNOWN');
  });

  it('classifies HTTP 429/402 quota responses as PROVIDER_UNAVAILABLE and non-auth 400 properly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 });
    const rateRes = await probeProviderApiKey('openrouter', 'sk-or-v1-quota-1234');
    expect(rateRes.valid).toBe(false);
    expect(rateRes.status).toBe('PROVIDER_UNAVAILABLE');
    expect(rateRes.message).toContain('quota or rate limit reached (429)');

    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400 });
    const badReq = await probeProviderApiKey('openrouter', 'sk-or-v1-badreq-1234');
    expect(badReq.valid).toBe(false);
    expect(badReq.message).toContain('Provider returned status 400');

    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 402 });
    const noCredits = await probeProviderApiKey('openrouter', 'sk-or-v1-nocredits-1234');
    expect(noCredits.valid).toBe(false);
    expect(noCredits.httpStatus).toBe(402);
    expect(noCredits.message).toContain('insufficient credits');
  });

  it('rejects OpenRouter keys whose /api/v1/auth/key metadata reports remaining credit <= 0', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { limit: 5, limit_remaining: 0 } }),
    });
    const exhausted = await probeProviderApiKey('openrouter', 'sk-or-v1-exhausted-9999');
    expect(exhausted.ok).toBe(false);
    expect(exhausted.valid).toBe(false);
    expect(exhausted.httpStatus).toBe(402);
    expect(exhausted.message_vi).toContain('hết hạn mức tín dụng');

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { limit: null, limit_remaining: null } }),
    });
    const uncapped = await probeProviderApiKey('openrouter', 'sk-or-v1-uncapped-8888');
    expect(uncapped.ok).toBe(true);
    expect(uncapped.valid).toBe(true);
  });
});
