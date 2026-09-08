/**
 * image-generate-action billing tests — deterministic, mock-based.
 *
 * Validates the fal-ai billing branch:
 * 1. Successful generation → MCU credit deducted once, usage event emitted.
 * 2. Insufficient credits → returns INSUFFICIENT_CREDITS, no success.
 * 3. MuAPI path is untouched (no billing, no R2).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (must be hoisted) ─────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
  getD1: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(() => Promise.resolve('fal_test_key')),
}));

const mockGenerate = vi.fn(() =>
  Promise.resolve({
    assetRef: 'https://fal.ai/images/test.png',
    provider: 'fal-ai',
    costCents: 0,
    latencyMs: 800,
    metadata: { model: 'fal-ai/flux-schnell' },
  }),
);
vi.mock('@/seed/ai/providers/fal-image-provider', () => ({
  FalImageProvider: class {
    generate = mockGenerate;
  },
}));

vi.mock('@/land/image/fal-image-r2-service', () => ({
  storeFalImageInR2: vi.fn(() =>
    Promise.resolve({
      permanentUrl: 'https://cdn.sophia.agencyos.network/media/fal/job123/image.png',
      storageKey: 'media/fal/job123/image.png',
      bucket: 'VIDEO_BUCKET',
      sizeBytes: 1024,
      usedFallback: false,
    }),
  ),
}));

const mockDeductCredits = vi.fn((_args: unknown[]) => Promise.resolve(true));
vi.mock('@/tree/mcu/credits-repo', () => ({
  deductCredits: (userId: string, amount: number, jobId: string, reason: string) =>
    mockDeductCredits([userId, amount, jobId, reason]),
}));

const mockTrackUsage = vi.fn((_event: Record<string, unknown>) => Promise.resolve({ success: true }));
vi.mock('@/tree/usage-metering', () => ({
  trackUsage: (event: Record<string, unknown>) => mockTrackUsage(event),
  calculateCredits: vi.fn(() => 1),
  hashLicenseKey: vi.fn(() => 'hashed_nonce_abc'),
  resolveUserLicenseNonce: vi.fn(() => Promise.resolve('license_nonce_xyz')),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { generateImageAction } from '../image-generate-action';

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedResolveTier = vi.mocked(resolveUserTier);

describe('generateImageAction — fal-ai billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: undefined,
      role: 'user',
    });
    mockedResolveTier.mockResolvedValue('BASIC');
  });

  it('deducts MCU credits and emits usage event on successful fal-ai generation', async () => {
    const result = await generateImageAction({
      prompt: 'A sunset over mountains',
      model: 'fal-ai/flux-schnell',
      aspectRatio: '1:1',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Credit deduction called exactly once with correct reason.
    expect(mockDeductCredits).toHaveBeenCalledTimes(1);
    const [userId, amount, jobId, reason] = mockDeductCredits.mock.calls[0]![0] as [
      string,
      number,
      string,
      string,
    ];
    expect(userId).toBe('user-1');
    expect(typeof amount).toBe('number');
    expect(amount).toBeGreaterThan(0);
    expect(jobId).toBe(result.jobId);
    expect(reason).toBe('fal-ai:imageGenerate');

    // Usage event emitted with metering parity.
    expect(mockTrackUsage).toHaveBeenCalledTimes(1);
    const event = mockTrackUsage.mock.calls[0][0];
    expect(event.service).toBe('fal-ai');
    expect(event.action).toBe('imageGenerate');
    expect(event.userId).toBe('user-1');
    expect(event.licenseNonce).toBe('license_nonce_xyz');
    expect(event.requestId).toBe(result.jobId);
  });

  it('returns INSUFFICIENT_CREDITS when deduction fails', async () => {
    mockDeductCredits.mockResolvedValueOnce(false);

    const result = await generateImageAction({
      prompt: 'A cat',
      model: 'fal-ai/flux-schnell',
    });

    expect(result).toEqual({ success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' });
    // Usage event must NOT be emitted when deduction fails.
    expect(mockTrackUsage).not.toHaveBeenCalled();
  });

  it('does not charge credits for MuAPI models (untouched path)', async () => {
    const result = await generateImageAction({
      prompt: 'A dog',
      model: 'flux-schnell',
    });

    // MuAPI path should not invoke fal-ai billing.
    expect(mockDeductCredits).not.toHaveBeenCalled();
    expect(mockTrackUsage).not.toHaveBeenCalled();
  });
});
