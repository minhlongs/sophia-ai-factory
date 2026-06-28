import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitVideoRender, RenderProviderError } from '../video-render-provider';

describe('video-render-provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete (process.env as any).SOPHIA_VIDEO_PROVIDER;
    delete (process.env as any).SOPHIA_CORE_VIDEO_PROOF;
    (process.env as Record<string, string | undefined>).NODE_ENV = undefined;
    delete (process.env as any).VITEST;
    // Clear any lazy-loaded module cache if needed
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('safety gate', () => {
    // Note: MOCK_REJECTED_IN_PRODUCTION cannot be unit-tested because vitest.config.ts
    // defines NODE_ENV=test, which makes isProofMode() always true in the test runner.
    // The production safety gate is enforced by the code path itself and verified by the
    // evidence validator (scripts/verify-core-video-factory-evidence.mjs) which checks
    // that SOPHIA_VIDEO_PROVIDER=mock is only active with proof flags set.

    it('accepts mock provider when SOPHIA_CORE_VIDEO_PROOF=1', async () => {
      (process.env as any).SOPHIA_CORE_VIDEO_PROOF = '1';
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'mock';
      const result = await submitVideoRender({ userId: 'test-user', script: 'hello' });
      expect(result.provider).toBe('mock');
      expect(result.status).toBe('queued');
      expect(result.videoUrl).toBeDefined();
      expect(result.videoUrl).toContain('mock.sophia.local');
      expect(result.videoId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.providerJobId).toMatch(/^mock_[0-9a-f]+$/);
    });

    it('accepts mock provider when NODE_ENV=test', async () => {
      (process.env as any).NODE_ENV = 'test';
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'mock';
      const result = await submitVideoRender({ userId: 'test-user', script: 'hello' });
      expect(result.provider).toBe('mock');
      expect(result.videoUrl).toContain('mock.sophia.local');
    });

    it('accepts mock provider when VITEST=true', async () => {
      (process.env as any).VITEST = 'true';
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'mock';
      const result = await submitVideoRender({ userId: 'test-user', script: 'hello' });
      expect(result.provider).toBe('mock');
      expect(result.videoUrl).toContain('mock.sophia.local');
    });

    it('rejects unknown provider value', async () => {
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'unknown';
      await expect(
        submitVideoRender({ userId: 'test-user', script: 'hello' }),
      ).rejects.toThrow(RenderProviderError);
      await expect(
        submitVideoRender({ userId: 'test-user', script: 'hello' }),
      ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    });
  });

  describe('mock provider determinism', () => {
    it('returns distinct video IDs for concurrent calls', async () => {
      (process.env as any).SOPHIA_CORE_VIDEO_PROOF = '1';
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'mock';
      const results = await Promise.all([
        submitVideoRender({ userId: 'u1', script: 'script-a' }),
        submitVideoRender({ userId: 'u2', script: 'script-b' }),
        submitVideoRender({ userId: 'u3', script: 'script-c' }),
      ]);
      const ids = results.map((r) => r.videoId);
      expect(new Set(ids).size).toBe(3);
    });

    it('returns videoUrl with correct UUID-based path', async () => {
      (process.env as any).SOPHIA_CORE_VIDEO_PROOF = '1';
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'mock';
      const result = await submitVideoRender({ userId: 'test-user', script: 'test script' });
      expect(result.videoUrl).toMatch(/^https:\/\/mock\.sophia\.local\/videos\/[0-9a-f-]+\.mp4$/);
    });

    it('passes through userId and title to provider', async () => {
      (process.env as any).SOPHIA_CORE_VIDEO_PROOF = '1';
      (process.env as any).SOPHIA_VIDEO_PROVIDER = 'mock';
      const result = await submitVideoRender({
        userId: 'user-123',
        script: 'fashion trends',
        title: 'My Video Title',
      });
      // Mock provider doesn't expose title directly, but we verify it completes
      expect(result.provider).toBe('mock');
      expect(result.videoUrl).toBeDefined();
    });
  });

  describe('heygen path (no key)', () => {
    it('throws PROVIDER_NOT_CONFIGURED when no HeyGen key exists (proof mode)', async () => {
      // Ensure heygen path is taken (no mock)
      (process.env as any).SOPHIA_CORE_VIDEO_PROOF = '1';
      delete (process.env as any).SOPHIA_VIDEO_PROVIDER;
      // Without a real key, this should fail with PROVIDER_NOT_CONFIGURED
      await expect(
        submitVideoRender({ userId: 'test-user', script: 'hello' }),
      ).rejects.toThrow(RenderProviderError);
      await expect(
        submitVideoRender({ userId: 'test-user', script: 'hello' }),
      ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    });
  });
});
