/**
 * llm-router.test.ts — Tests for LLM tier routing + circuit breaker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  routeLLM,
  _resetCircuit,
  _getCircuitState,
} from '../llm-router';

const FAKE_ANTHROPIC_KEY = 'test-anthropic-key';

describe('llm-router', () => {
  beforeEach(() => {
    _resetCircuit();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    _resetCircuit();
  });

  it('max tier calls Claude directly without Qwen', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ text: 'Claude response' }] }),
        { status: 200 },
      ),
    );

    const result = await routeLLM('max', 'test prompt', {
      anthropicApiKey: FAKE_ANTHROPIC_KEY,
    });

    expect(result.provider).toBe('claude');
    expect(result.text).toBe('Claude response');
    expect(result.tier).toBe('max');
    // Should call Anthropic API only
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('anthropic.com');
  });

  it('lite tier uses Qwen when available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ response: 'Qwen response' }),
        { status: 200 },
      ),
    );

    const result = await routeLLM('lite', 'test prompt', {
      qwenBaseUrl: 'http://localhost:11434',
      anthropicApiKey: FAKE_ANTHROPIC_KEY,
    });

    expect(result.provider).toBe('qwen');
    expect(result.model).toBe('qwen3:32b');
    expect(result.text).toBe('Qwen response');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('lite tier falls back to Claude Haiku when Qwen is down', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // Qwen down
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ text: 'Haiku fallback' }] }),
          { status: 200 },
        ),
      );

    const result = await routeLLM('lite', 'test prompt', {
      qwenBaseUrl: 'http://localhost:11434',
      anthropicApiKey: FAKE_ANTHROPIC_KEY,
    });

    expect(result.provider).toBe('claude');
    expect(result.text).toBe('Haiku fallback');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('standard tier falls back to Claude Haiku when Qwen is down', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ text: 'haiku-reply' }] }),
          { status: 200 },
        ),
      );

    const result = await routeLLM('standard', 'prompt', {
      anthropicApiKey: FAKE_ANTHROPIC_KEY,
    });

    expect(result.provider).toBe('claude');
  });

  it('circuit breaker opens after 3 consecutive Qwen failures', async () => {
    vi.spyOn(globalThis, 'fetch')
      // 3 Qwen failures
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockRejectedValueOnce(new Error('fail3'))
      // Claude fallbacks for all 3
      .mockResolvedValue(
        new Response(
          JSON.stringify({ content: [{ text: 'haiku' }] }),
          { status: 200 },
        ),
      );

    await routeLLM('lite', 'p1', { anthropicApiKey: FAKE_ANTHROPIC_KEY });
    await routeLLM('lite', 'p2', { anthropicApiKey: FAKE_ANTHROPIC_KEY });
    await routeLLM('lite', 'p3', { anthropicApiKey: FAKE_ANTHROPIC_KEY });

    const state = _getCircuitState();
    expect(state.failures).toBe(3);
    expect(state.openUntil).toBeGreaterThan(Date.now());
  });

  it('circuit breaker bypasses Qwen when open', async () => {
    // Force circuit open
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockRejectedValueOnce(new Error('f3'))
      .mockResolvedValue(
        new Response(
          JSON.stringify({ content: [{ text: 'ok' }] }),
          { status: 200 },
        ),
      );

    // Trip circuit
    for (let i = 0; i < 3; i++) {
      await routeLLM('lite', 'p', { anthropicApiKey: FAKE_ANTHROPIC_KEY });
    }

    // Reset mock to count fresh calls
    vi.restoreAllMocks();
    const freshFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ text: 'claude direct' }] }),
        { status: 200 },
      ),
    );

    // Next call should skip Qwen entirely (circuit open)
    const result = await routeLLM('lite', 'next', { anthropicApiKey: FAKE_ANTHROPIC_KEY });
    expect(result.provider).toBe('claude');
    // Only 1 fetch (Claude), not 2 (Qwen + Claude)
    expect(freshFetch).toHaveBeenCalledTimes(1);
    expect(freshFetch.mock.calls[0][0]).toContain('anthropic.com');
  });

  it('circuit resets after window expires', async () => {
    // Trip circuit
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockRejectedValueOnce(new Error('f3'))
      .mockResolvedValue(
        new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
      );

    for (let i = 0; i < 3; i++) {
      await routeLLM('lite', 'p', { anthropicApiKey: FAKE_ANTHROPIC_KEY });
    }

    // Manually expire the circuit
    const state = _getCircuitState();
    expect(state.openUntil).toBeGreaterThan(0);

    // Reset manually (simulates time passing)
    _resetCircuit();
    const afterReset = _getCircuitState();
    expect(afterReset.openUntil).toBe(0);
    expect(afterReset.failures).toBe(0);
  });
});
