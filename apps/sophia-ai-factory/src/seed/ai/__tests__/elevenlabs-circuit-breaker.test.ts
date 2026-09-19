/**
 * ElevenLabs Per-Tenant Circuit Breaker Isolation Tests
 *
 * Tests:
 * 1. keyRef propagation to shouldAllowRequest, recordSuccess, and recordFailure.
 * 2. Multi-tenant isolation: Tenant A auth failure trips breaker only for Tenant A.
 * 3. Tenant B and platform requests remain unblocked when Tenant A is open.
 *
 * @module seed/ai/__tests__/elevenlabs-circuit-breaker.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateElevenLabsVoiceover, uploadAudioToStorage } from '@/seed/ai/elevenlabs-api-client';
import { shouldAllowRequest, recordSuccess } from '@/seed/security/circuit-breaker';

describe('ElevenLabs Per-Tenant Circuit Breaker Isolation', () => {
  beforeEach(() => {
    // Reset any open breakers for test keys
    recordSuccess('elevenlabs', 'tenant_a');
    recordSuccess('elevenlabs', 'tenant_b');
    recordSuccess('elevenlabs', 'platform');
  });

  it('passes keyRef to circuit breaker and isolates failure per tenant', async () => {
    const tenantA = 'tenant_a';
    const tenantB = 'tenant_b';

    // Verify initially both tenants are allowed
    expect(shouldAllowRequest('elevenlabs', tenantA)).toBe(true);
    expect(shouldAllowRequest('elevenlabs', tenantB)).toBe(true);

    // Mock withTimeout that returns 401 unauthorized for tenant A
    const mockTimeout = vi.fn().mockResolvedValue(
      new Response('Invalid ElevenLabs API key', { status: 401 }),
    );

    // Call for tenant A: should throw ProviderInvalidKeyError and trip tenant A's circuit breaker
    await expect(
      generateElevenLabsVoiceover(
        'Test voiceover for tenant A',
        'ENTERPRISE',
        'invalid_key_a',
        undefined,
        { withTimeout: mockTimeout, keyRef: tenantA },
      ),
    ).rejects.toThrow();

    // Circuit breaker for tenant A MUST NOW BE OPEN (401 triggers immediate OPEN)
    expect(shouldAllowRequest('elevenlabs', tenantA)).toBe(false);

    // Next call for tenant A fails immediately at circuit breaker gate without making HTTP request
    await expect(
      generateElevenLabsVoiceover(
        'Another request for tenant A',
        'ENTERPRISE',
        'invalid_key_a',
        undefined,
        { withTimeout: mockTimeout, keyRef: tenantA },
      ),
    ).rejects.toThrow(/Circuit breaker open for elevenlabs/);

    // CRITICAL ISOLATION CHECK: Tenant B MUST REMAIN ALLOWED
    expect(shouldAllowRequest('elevenlabs', tenantB)).toBe(true);

    // CRITICAL ISOLATION CHECK: Platform default MUST REMAIN ALLOWED
    expect(shouldAllowRequest('elevenlabs')).toBe(true);
    expect(shouldAllowRequest('elevenlabs', 'platform')).toBe(true);
  });

  it('records success and returns audio output when request succeeds with keyRef', async () => {
    const tenantB = 'tenant_b';
    const fakeAudioBytes = new Uint8Array([0, 1, 2, 3, 4]);

    const mockTimeout = vi.fn().mockResolvedValue(
      new Response(fakeAudioBytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    );

    const mockUpload = vi.fn().mockResolvedValue('https://cdn.test/audio/tenant_b/video1/abc.mp3');

    const result = await generateElevenLabsVoiceover(
      'Short narration text',
      'BASIC',
      'valid_key_b',
      undefined,
      { withTimeout: mockTimeout, uploadToR2: mockUpload, keyRef: tenantB },
    );

    expect(result.audio_url).toBe('https://cdn.test/audio/tenant_b/video1/abc.mp3');
    expect(result.duration).toBeGreaterThanOrEqual(1);
    expect(shouldAllowRequest('elevenlabs', tenantB)).toBe(true);
    expect(mockUpload).toHaveBeenCalled();
  });

  it('uploadAudioToStorage handles payloads > 65KB without RangeError call stack overflow', async () => {
    // 150KB synthetic audio payload
    const largeAudio = new Uint8Array(150_000);
    for (let i = 0; i < largeAudio.length; i++) {
      largeAudio[i] = i % 256;
    }

    const dataUri = await uploadAudioToStorage(largeAudio);
    expect(dataUri).toBeDefined();
    expect(dataUri.startsWith('data:audio/mpeg;base64,')).toBe(true);
    expect(dataUri.length).toBeGreaterThan(150_000);
  });

  it('generateElevenLabsVoiceover clamps estimated duration to minimum 1s for short text', async () => {
    const fakeAudioBytes = new Uint8Array([1, 2, 3]);
    const mockTimeout = vi.fn().mockResolvedValue(
      new Response(fakeAudioBytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    );

    const result = await generateElevenLabsVoiceover(
      'Hi', // length 2 -> Math.floor(2/15) is 0 -> clamped to 1
      'BASIC',
      'test_key',
      undefined,
      { withTimeout: mockTimeout, keyRef: 'tenant_b' },
    );

    expect(result.duration).toBe(1);
  });
});
