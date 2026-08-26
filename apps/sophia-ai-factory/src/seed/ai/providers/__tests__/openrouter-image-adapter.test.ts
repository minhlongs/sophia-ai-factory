/**
 * OpenRouter Image Adapter tests — contract coverage matching
 * anthropic-adapter.test.ts patterns.
 *
 * Happy path / missing key / HTTP error / empty response / network throw.
 * Uses vi.fn() on global.fetch — no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterImageAdapter } from '../openrouter-image-adapter';
import type { ChatMessage, ChatOptions, StreamChunk } from '../../provider-interface';
import { reset as resetCircuitBreaker } from '@/seed/security/circuit-breaker';

function makeImageResponse(b64Json: string) {
  return JSON.stringify({
    created: 1748372400,
    data: [
      {
        b64_json: b64Json,
        media_type: 'image/png',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 4175,
      total_tokens: 4275,
      cost: 0.04,
    },
  });
}

const BASE_MESSAGES: ChatMessage[] = [{ role: 'user', content: 'A beautiful sunset over mountains' }];
const BASE_OPTIONS: ChatOptions = {
  model: 'openai/dall-e-3',
  apiKey: 'sk-or-test-key',
  maxTokens: 1024,
};

describe('OpenRouterImageAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    resetCircuitBreaker('openrouter-image');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Test 1: happy path ─────────────────────────────────────────────────────────

  it('happy path: returns base64 data URI with correct model and usage', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeImageResponse('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await adapter.chat(BASE_MESSAGES, BASE_OPTIONS);

    expect(result.content).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    expect(result.model).toBe('openai/dall-e-3');
    expect(result.provider).toBe('openrouter');
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(4175);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();

    // Verify correct headers sent
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/images');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-or-test-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['HTTP-Referer']).toBe('https://sophia.agencyos.network');

    // Verify body shape
    const body = JSON.parse(init.body as string) as {
      model: string;
      prompt: string;
      n: number;
      size: string;
      response_format: string;
      quality: string;
      style: string;
    };
    expect(body.model).toBe('openai/dall-e-3');
    expect(body.prompt).toBe('A beautiful sunset over mountains');
    expect(body.n).toBe(1);
    expect(body.response_format).toBe('b64_json');
  });

  // ── Test 2: missing apiKey (constructor-time OK, call-time throws) ────────────

  it('missing apiKey at call time: throws without calling fetch', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: undefined });

    await expect(
      adapter.chat(BASE_MESSAGES, { ...BASE_OPTIONS, apiKey: '' }),
    ).rejects.toThrow('OPENROUTER_IMAGE_MISSING_API_KEY');

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // ── Test 3: HTTP 500 ──────────────────────────────────────────────────────────

  it('HTTP 500: throws with status code in message', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );

    await expect(adapter.chat(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow('OpenRouter Image HTTP 500');
  });

  // ── Test 4: empty response data array ──────────────────────────────────────────

  it('empty data array: throws OPENROUTER_IMAGE_EMPTY_RESPONSE', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    const emptyResponse = JSON.stringify({
      created: 1748372400,
      data: [],
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyResponse, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await expect(adapter.chat(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow('OPENROUTER_IMAGE_EMPTY_RESPONSE');
  });

  // ── Test 5: network error ──────────────────────────────────────────────────────

  it('network error: propagates the original error', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch: ECONNREFUSED'));

    await expect(adapter.chat(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow('Failed to fetch: ECONNREFUSED');
  });

  // ── Test 6: 401 unauthorized (invalid key) ────────────────────────────────────

  it('HTTP 401: throws with status in message', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-invalid-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(adapter.chat(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow('OpenRouter Image HTTP 401');
  });

  // ── Test 7: 429 rate limited ───────────────────────────────────────────────────

  it('HTTP 429: throws with status in message', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response('Rate Limited', { status: 429 }),
    );

    await expect(adapter.chat(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow('OpenRouter Image HTTP 429');
  });

  // ── Test 8: prompt extraction (last user message) ──────────────────────────────

  it('extracts prompt from last user message, ignoring system/assistant', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeImageResponse('test'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a creative assistant' },
      { role: 'user', content: 'First prompt' },
      { role: 'assistant', content: 'Here is an image' },
      { role: 'user', content: 'Final prompt to use' },
    ];

    await adapter.chat(messages, BASE_OPTIONS);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { prompt: string };
    expect(body.prompt).toBe('Final prompt to use');
  });

  // ── Test 9: size normalization ─────────────────────────────────────────────────

  it('normalizes size parameter from extraBody', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeImageResponse('test'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await adapter.chat(BASE_MESSAGES, {
      ...BASE_OPTIONS,
      extraBody: { size: ' 1792x1024 ' } as Record<string, unknown>,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { size: string };
    expect(body.size).toBe('1792x1024');
  });

  // ── Test 10: invalid size falls back to default ────────────────────────────────

  it('invalid size falls back to 1024x1024', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeImageResponse('test'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await adapter.chat(BASE_MESSAGES, {
      ...BASE_OPTIONS,
      extraBody: { size: '999x999' } as Record<string, unknown>,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { size: string };
    expect(body.size).toBe('1024x1024');
  });

  // ── Test 11: quality/style passthrough ─────────────────────────────────────────

  it('passes quality and style from extraBody', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeImageResponse('test'), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await adapter.chat(BASE_MESSAGES, {
      ...BASE_OPTIONS,
      extraBody: { quality: 'hd', style: 'natural' },
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { quality: string; style: string };
    expect(body.quality).toBe('hd');
    expect(body.style).toBe('natural');
  });

  // ── Test 12: stream() yields single completion chunk ───────────────────────────

  it('stream yields single text_delta chunk with done=true', async () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    vi.mocked(fetch).mockResolvedValue(
      new Response(makeImageResponse('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const chunks: StreamChunk[] = [];
    for await (const chunk of adapter.stream(BASE_MESSAGES, BASE_OPTIONS)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('text_delta');
    const firstChunk = chunks[0] as { type: string; delta?: string; done?: boolean };
    expect(firstChunk.delta).toContain('data:image/png;base64,');
    expect(chunks[0].done).toBe(true);
  });

  // ── Test 13: countTokens heuristic ─────────────────────────────────────────────

  it('countTokens returns reasonable heuristic estimate', () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    const tokens = adapter.countTokens(
      [{ role: 'user', content: 'Hello world' }],
      'openai/dall-e-3',
    );
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  // ── Test 14: estimateCost pricing table ────────────────────────────────────────

  it('estimateCost returns known prices for supported models', () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    const costDallE3Standard = adapter.estimateCost(
      [{ role: 'user', content: 'test' }],
      'openai/dall-e-3',
      { model: 'openai/dall-e-3', apiKey: 'sk-or-test-key', extraBody: { quality: 'standard', size: '1024x1024' } as Record<string, unknown> },
    );
    expect(costDallE3Standard).toBeCloseTo(0.04, 2);

    const costDallE3HD = adapter.estimateCost(
      [{ role: 'user', content: 'test' }],
      'openai/dall-e-3',
      { model: 'openai/dall-e-3', apiKey: 'sk-or-test-key', extraBody: { quality: 'hd', size: '1024x1024' } as Record<string, unknown> },
    );
    expect(costDallE3HD).toBeCloseTo(0.08, 2);

    const costDallE2 = adapter.estimateCost(
      [{ role: 'user', content: 'test' }],
      'openai/dall-e-2',
      { model: 'openai/dall-e-2', apiKey: 'sk-or-test-key', extraBody: { size: '512x512' } as Record<string, unknown> },
    );
    expect(costDallE2).toBeCloseTo(0.018, 2);
  });

  // ── Test 15: getCapabilities returns static capabilities ───────────────────────

  it('getCapabilities returns non-streaming image capabilities', () => {
    const adapter = new OpenRouterImageAdapter({ apiKey: 'sk-or-test-key' });

    const caps = adapter.getCapabilities('openai/dall-e-3');
    expect(caps.streaming).toBe(false);
    expect(caps.systemRole).toBe(false);
    expect(caps.vision).toBe(false);
    expect(caps.functionCalling).toBe(false);
    expect(caps.maxInputTokens).toBe(4096);
    expect(caps.maxOutputTokens).toBe(0);
  });

  // ── Test 16: label and id are correct ──────────────────────────────────────────

  it('has correct id and label', () => {
    const adapter = new OpenRouterImageAdapter({ label: 'Custom Label' });
    expect(adapter.id).toBe('openrouter');
    expect(adapter.label).toBe('Custom Label');
  });
});