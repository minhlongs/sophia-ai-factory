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
});
