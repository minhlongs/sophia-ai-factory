/**
 * Unit tests for Kokoro-82M TTS Adapter & Vietnamese BYOK ElevenLabs router.
 * @module tree/video/audio/__tests__/kokoro-tts-adapter.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chunkScriptIntoSentences,
  isVietnameseLocale,
  synthesizeWithKokoroOrByok,
} from '../kokoro-tts-adapter';
import { reset, recordFailure } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

describe('kokoro-tts-adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset('kokoro-tts', 'org_alpha');
    reset('kokoro-tts', 'user_1');
  });

  it('identifies Vietnamese locale tags accurately', () => {
    expect(isVietnameseLocale('vi')).toBe(true);
    expect(isVietnameseLocale('vi-VN')).toBe(true);
    expect(isVietnameseLocale('vi_VN')).toBe(true);
    expect(isVietnameseLocale('en')).toBe(false);
    expect(isVietnameseLocale('en-US')).toBe(false);
    expect(isVietnameseLocale(undefined)).toBe(false);
  });

  it('splits narration scripts into sentence-aligned chunks under maxChunkChars including unspaced CJK text', () => {
    const script =
      'First sentence is short. Second sentence explains the core value proposition clearly! Third sentence asks the viewer to click the partner link right now.';
    const chunks = chunkScriptIntoSentences(script, 80);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(80);
    }
    expect(chunks.join(' ')).toBe(script);

    const cjk = 'あ'.repeat(110);
    const cjkChunks = chunkScriptIntoSentences(cjk, 40);
    expect(cjkChunks.map((c) => c.length)).toEqual([40, 40, 30]);
    expect(cjkChunks.join('')).toBe(cjk);
  });

  it('routes Vietnamese locale (vi / vi-VN) directly to BYOK ElevenLabs fallback', async () => {
    const byokFallback = vi.fn().mockResolvedValue({
      success: true,
      audioUrl: 'https://r2.sophia.local/tenants/org_alpha/vo_vi.mp3',
      durationSec: 18.5,
      provider: 'elevenlabs' as const,
    });
    const fetchSpy = vi.fn();

    const result = await synthesizeWithKokoroOrByok(
      {
        planId: 'plan_vi_1',
        userId: 'user_1',
        tenantId: 'org_alpha',
        text: 'Xin chào các bạn, hôm nay chúng ta cùng khám phá công cụ AI mới.',
        locale: 'vi-VN',
        baseUrl: 'https://kokoro.internal',
      },
      {
        fetchFn: fetchSpy as unknown as typeof fetch,
        byokFallback,
      },
    );

    expect(result.success).toBe(true);
    expect(result.routedToByok).toBe(true);
    expect(result.provider).toBe('elevenlabs');
    expect(result.audioUrl).toContain('vo_vi.mp3');
    expect(byokFallback).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('synthesizes multi-sentence English scripts via /v1/audio/speech and merges audio bytes', async () => {
    const fetchSpy = vi.fn(async () => {
      const payload = new Uint8Array([1, 2, 3, 4]);
      return new Response(payload, { status: 200 });
    });

    const result = await synthesizeWithKokoroOrByok(
      {
        planId: 'plan_en_1',
        userId: 'user_1',
        tenantId: 'org_alpha',
        text: 'Sentence one is ready. Sentence two follows immediately after.',
        locale: 'en',
        baseUrl: 'https://kokoro.internal',
        maxChunkChars: 40,
      },
      { fetchFn: fetchSpy as unknown as typeof fetch },
    );

    expect(result.success).toBe(true);
    expect(result.routedToByok).toBe(false);
    expect(result.provider).toBe('kokoro');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.audioBytes?.byteLength).toBe(8);
    expect(result.chunks).toHaveLength(2);
  });

  it('classifies HTTP 429 rate-limit failure and records circuit breaker failure', async () => {
    const fetchSpy = vi.fn(async () => new Response('rate limited', { status: 429 }));

    const result = await synthesizeWithKokoroOrByok(
      {
        planId: 'plan_en_2',
        userId: 'user_1',
        tenantId: 'org_alpha',
        text: 'Test rate limit handling.',
        locale: 'en',
        baseUrl: 'https://kokoro.internal',
      },
      { fetchFn: fetchSpy as unknown as typeof fetch },
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_QUOTA_EXCEEDED');
    expect(result.failureKind).toBe(FailureKind.RATE_LIMIT);
  });

  it('short-circuits when the Kokoro circuit breaker is open for the workspace', async () => {
    recordFailure('kokoro-tts', FailureKind.AUTH_FAILURE, 'org_alpha');
    const fetchSpy = vi.fn();

    const result = await synthesizeWithKokoroOrByok(
      {
        planId: 'plan_en_3',
        userId: 'user_1',
        tenantId: 'org_alpha',
        text: 'Should not dispatch when circuit breaker is open.',
        locale: 'en',
        baseUrl: 'https://kokoro.internal',
      },
      { fetchFn: fetchSpy as unknown as typeof fetch },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('circuit breaker is open');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
