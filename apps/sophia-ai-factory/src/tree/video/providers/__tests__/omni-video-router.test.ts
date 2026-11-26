/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_VIDEO_PROVIDER_ORDER,
  routeVideoRenderWithFailover,
  type OmniVideoProviderAdapter,
} from '../omni-video-router';

const mockShouldAllow = vi.fn();
const mockRecordSuccess = vi.fn();
const mockRecordFailure = vi.fn();

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: (...args: unknown[]) => mockShouldAllow(...args),
  recordSuccess: (...args: unknown[]) => mockRecordSuccess(...args),
  recordFailure: (...args: unknown[]) => mockRecordFailure(...args),
}));

describe('OmniRouter-Style Multi-Provider Video Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldAllow.mockReturnValue(true);
  });

  it('fails over automatically from HeyGen -> D-ID when HeyGen fails and records full telemetry', async () => {
    expect(DEFAULT_VIDEO_PROVIDER_ORDER).toEqual(['heygen', 'did', 'kling', 'browser_h264_mp4']);

    const adapters: readonly OmniVideoProviderAdapter[] = [
      {
        id: 'heygen',
        isConfigured: () => true,
        submit: vi.fn().mockRejectedValue(new Error('HEYGEN_SUBMIT_HTTP_503')),
      },
      {
        id: 'did',
        isConfigured: () => true,
        submit: vi.fn().mockResolvedValue({ jobId: 'did_job_99', mode: 'async_provider' }),
      },
    ];

    const res = await routeVideoRenderWithFailover(
      { userId: 'u_1', title: 'Review', script: 'Hello', aspectRatio: '9:16' },
      adapters,
    );

    expect(res.selectedProvider).toBe('did');
    expect(res.jobId).toBe('did_job_99');
    expect(res.failoverOccurred).toBe(true);
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0].outcome).toBe('failed');
    expect(res.attempts[1].outcome).toBe('succeeded');
    expect(mockRecordFailure).toHaveBeenCalledTimes(1);
    expect(mockRecordSuccess).toHaveBeenCalledWith('did', 'byok:u_1');
  });

  it('skips unconfigured and breaker-open providers and falls back to browser_h264_mp4', async () => {
    mockShouldAllow.mockImplementation((provider: string) => provider !== 'heygen');

    const adapters: readonly OmniVideoProviderAdapter[] = [
      { id: 'heygen', isConfigured: () => true, submit: vi.fn() },
      { id: 'did', isConfigured: () => false, submit: vi.fn() },
      { id: 'kling', isConfigured: () => true, submit: vi.fn().mockRejectedValue(new Error('timeout')) },
    ];

    const res = await routeVideoRenderWithFailover(
      { userId: 'u_2', title: 'Review', script: 'Hello', aspectRatio: '16:9' },
      adapters,
    );

    expect(res.selectedProvider).toBe('browser_h264_mp4');
    expect(res.mode).toBe('client_fallback');
    expect(res.failoverOccurred).toBe(true);
    expect(res.attempts.map((a) => a.outcome)).toEqual([
      'skipped_breaker_open',
      'skipped_unconfigured',
      'failed',
    ]);
  });
});
