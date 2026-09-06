/**
 * Hermes Antigravity Adapter tests — contract coverage for local SDXL provider.
 * Happy path / missing key / HTTP errors / timeout / circuit breaker / stream.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HermesAntigravityAdapter } from '../hermes-antigravity-adapter';
import type { ChatMessage, ChatOptions, StreamChunk } from '../../provider-interface';
import {
  shouldAllowRequest, recordSuccess, recordFailure,
} from '@/seed/security/circuit-breaker';

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: vi.fn().mockReturnValue('NETWORK'),
  FailureKind: { NETWORK: 'NETWORK', AUTH_FAILURE: 'AUTH_FAILURE', RATE_LIMIT: 'RATE_LIMIT', SERVER_ERROR: 'SERVER_ERROR', UNKNOWN: 'UNKNOWN' },
}));

function jsonResponse(b64: string) {
  return new Response(JSON.stringify({ data: [{ b64_json: b64 }], usage: { prompt_tokens: 10, completion_tokens: 20 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
const MSGS: ChatMessage[] = [{ role: 'user', content: 'A neon cyberpunk cityscape at night' }];
const OPTS: ChatOptions = { model: 'hermes-1', apiKey: 'test-hermes-key' };

describe('HermesAntigravityAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    (shouldAllowRequest as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('construction with and without apiKey succeeds', () => {
    expect(() => new HermesAntigravityAdapter()).not.toThrow();
    expect(() => new HermesAntigravityAdapter({ apiKey: 'k' })).not.toThrow();
  });
  it('defaults to local baseUrl, id=hermes, correct label', () => {
    const a = new HermesAntigravityAdapter();
    expect(a.baseUrl).toBe('http://127.0.0.1:8100');
    expect(a.id).toBe('hermes');
    expect(a.label).toBe('Hermes Antigravity (Local)');
  });
  it('chat() happy path returns base64 data URI with correct metadata', async () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'test-hermes-key' });
    vi.mocked(fetch).mockResolvedValue(jsonResponse('abc123base64'));
    const result = await adapter.chat(MSGS, OPTS);
    expect(result.content).toBe('data:image/png;base64,abc123base64');
    expect(result.provider).toBe('hermes');
    expect(result.model).toBe('hermes-1');
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(recordSuccess).toHaveBeenCalledWith('hermes-antigravity');
  });
  it('chat() throws HERMES_MISSING_API_KEY when no apiKey available', async () => {
    const adapter = new HermesAntigravityAdapter();
    await expect(adapter.chat(MSGS, { model: 'hermes-1', apiKey: '' })).rejects.toThrow('HERMES_MISSING_API_KEY');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('chat() HTTP 401 throws with retryable=false', async () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'bad' });
    vi.mocked(fetch).mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    try {
      await adapter.chat(MSGS, { ...OPTS, apiKey: 'bad' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('HTTP 401');
      expect((err as { retryable?: boolean }).retryable).toBe(false);
      expect((err as { status?: number }).status).toBe(401);
    }
    expect(recordFailure).toHaveBeenCalledWith('hermes-antigravity', expect.any(String));
  });
  it('chat() HTTP 429 throws with retryable=true', async () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'test-hermes-key' });
    vi.mocked(fetch).mockResolvedValue(new Response('Rate Limited', { status: 429 }));
    try {
      await adapter.chat(MSGS, OPTS);
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('HTTP 429');
      expect((err as { retryable?: boolean }).retryable).toBe(true);
    }
  });
  it('chat() HTTP 500 throws with retryable=true', async () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'test-hermes-key' });
    vi.mocked(fetch).mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
    try {
      await adapter.chat(MSGS, OPTS);
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('HTTP 500');
      expect((err as { retryable?: boolean }).retryable).toBe(true);
    }
  });
  it('chat() network error propagates original error', async () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'test-hermes-key' });
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(adapter.chat(MSGS, OPTS)).rejects.toThrow('ECONNREFUSED');
    expect(recordFailure).toHaveBeenCalledWith('hermes-antigravity', expect.any(String));
  });
  it('chat() throws when circuit breaker is open', async () => {
    (shouldAllowRequest as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const adapter = new HermesAntigravityAdapter({ apiKey: 'test-hermes-key' });
    await expect(adapter.chat(MSGS, OPTS)).rejects.toThrow('Circuit breaker open');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('estimateCost() returns 0 (local provider is free)', () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'k' });
    expect(adapter.estimateCost(MSGS, 'hermes-1')).toBe(0);
  });
  it('getCapabilities() returns expected static profile', () => {
    const caps = new HermesAntigravityAdapter({ apiKey: 'k' }).getCapabilities('hermes-1');
    expect(caps).toEqual({ streaming: false, systemRole: false, maxOutputTokens: 0, maxInputTokens: 4096, functionCalling: false, vision: false });
  });
  it('countTokens() returns positive for non-empty prompt, 0 for empty', () => {
    const a = new HermesAntigravityAdapter({ apiKey: 'k' });
    expect(a.countTokens(MSGS, 'hermes-1')).toBeGreaterThan(0);
    expect(a.countTokens([], 'hermes-1')).toBe(0);
  });
  it('stream() yields single text_delta chunk wrapping chat response', async () => {
    const adapter = new HermesAntigravityAdapter({ apiKey: 'test-hermes-key' });
    vi.mocked(fetch).mockResolvedValue(jsonResponse('b64data'));
    const chunks: StreamChunk[] = [];
    for await (const chunk of adapter.stream(MSGS, OPTS)) chunks.push(chunk);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('text_delta');
    expect(chunks[0].done).toBe(true);
    const c = chunks[0] as { type: string; delta?: string };
    expect(c.delta).toContain('data:image/png;base64,b64data');
  });
});
