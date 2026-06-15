/**
 * /api/internal/tts — voicePresetId resolution path.
 *
 * Verifies that:
 * - Unknown voicePresetId returns 400
 * - Valid voicePresetId resolves to coquiSpeaker → forwarded as voice_ref_url
 * - Preset language is auto-filled when caller omits language
 * - Caller-supplied language overrides preset default
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/land/video/r2-binding', () => ({
  getVideoBucket: vi.fn(),
  tenantScopedKey: vi.fn((t: string, j: string, s: string) => `tenants/${t}/videos/${j}/${s}`),
}));

vi.mock('@/land/video/r2-multipart-upload', () => ({
  uploadToR2: vi.fn().mockResolvedValue(undefined),
}));

import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/r2-binding';
import { POST } from '../route';

const mockChain = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null }),
};

const ORIGINAL_FETCH = globalThis.fetch;

function buildRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/internal/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

interface CapturedFetch {
  url: string;
  voiceRefUrl: string | null;
  language: string;
}

/**
 * Install a fetch stub that captures the body sent to Coqui and returns a stub
 * WAV response. Returns a getter for the captured payload.
 */
function installFetchCapture(): () => CapturedFetch | null {
  let captured: CapturedFetch | null = null;
  const stub = async (url: unknown, init: unknown) => {
    const initObj = init as { body?: string };
    const parsed = JSON.parse(initObj.body ?? '{}') as {
      voice_ref_url: string | null;
      language: string;
    };
    captured = {
      url: String(url),
      voiceRefUrl: parsed.voice_ref_url,
      language: parsed.language,
    };
    return new Response(new ArrayBuffer(8), {
      status: 200,
      headers: { 'x-duration-sec': '1' },
    });
  };
  globalThis.fetch = stub as unknown as typeof fetch;
  return () => captured;
}

describe('POST /api/internal/tts — voicePresetId resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COQUI_INTERNAL_TOKEN = 'test-internal-token';
    process.env.COQUI_FLY_URL = 'http://coqui.test';

    vi.mocked(createServerClient).mockReturnValue({
      from: () => mockChain,
    } as unknown as ReturnType<typeof createServerClient>);

    vi.mocked(getVideoBucket).mockResolvedValue({
      bucket: { put: vi.fn(), createMultipartUpload: vi.fn() } as unknown as R2Bucket,
      publicBaseUrl: null,
    });
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.COQUI_FLY_URL;
    delete process.env.COQUI_INTERNAL_TOKEN;
  });

  it('returns 400 for unknown voicePresetId', async () => {
    const resp = await POST(
      buildRequest({
        text: 'hello',
        voicePresetId: 'does-not-exist-9999',
        tenantId: 't1',
        jobId: 'j1',
      }, { 'x-internal-token': 'test-internal-token' }),
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toMatch(/voicePresetId/);
  });

  it('forwards preset.coquiSpeaker as voice_ref_url to Coqui', async () => {
    const getCaptured = installFetchCapture();
    await POST(
      buildRequest({
        text: 'hello',
        voicePresetId: 'alex-en-m',
        tenantId: 't1',
        jobId: 'j-alex',
      }, { 'x-internal-token': 'test-internal-token' }),
    );
    const captured = getCaptured();
    expect(captured).not.toBeNull();
    expect(captured?.voiceRefUrl).toBe('Damien Black'); // alex-en-m → Damien Black
    expect(captured?.language).toBe('en');
  });

  it('uses preset language when language not explicitly provided', async () => {
    const getCaptured = installFetchCapture();
    await POST(
      buildRequest({
        text: 'xin chào',
        voicePresetId: 'linh-vi-f',
        tenantId: 't1',
        jobId: 'j-linh',
      }, { 'x-internal-token': 'test-internal-token' }),
    );
    expect(getCaptured()?.language).toBe('vi');
  });

  it('explicit language overrides preset default', async () => {
    const getCaptured = installFetchCapture();
    await POST(
      buildRequest({
        text: 'hello',
        voicePresetId: 'linh-vi-f',
        language: 'en',
        tenantId: 't1',
        jobId: 'j-override',
      }, { 'x-internal-token': 'test-internal-token' }),
    );
    expect(getCaptured()?.language).toBe('en');
  });

  it('falls back to voiceId when no preset provided', async () => {
    const getCaptured = installFetchCapture();
    await POST(
      buildRequest({
        text: 'hello',
        voiceId: 'https://example.com/custom-voice.wav',
        tenantId: 't1',
        jobId: 'j-byov',
      }, { 'x-internal-token': 'test-internal-token' }),
    );
    expect(getCaptured()?.voiceRefUrl).toBe('https://example.com/custom-voice.wav');
  });

  it('rejects requests with a missing internal token when configured', async () => {
    const resp = await POST(
      buildRequest({
        text: 'hello',
        tenantId: 't1',
        jobId: 'j-auth',
      }),
    );

    expect(resp.status).toBe(401);
  });
});
