/**
 * Unit tests for generateVideoAction server action.
 *
 * Tests:
 * - Rejects unauthenticated user (returns UNAUTHENTICATED)
 * - Rejects invalid input (returns VALIDATION_ERROR)
 * - Rejects when quota exceeded (returns QUOTA_EXCEEDED)
 * - Creates mission row and emits event on success
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// The action now preflight-checks the operator-keyed AI pipeline. Set the keys
// before importing the module so tests exercise the happy path; individual
// tests can clear them to drive the AI_VIDEO_UNAVAILABLE branch.
const ORIGINAL_ENV = { ...process.env };
process.env.WAN_API_KEY = 'test-wan';
process.env.FISH_SPEECH_API_KEY = 'test-fish';
process.env.CLOUDCONVERT_API_KEY = 'test-cc';
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('MASTER'),
}));

vi.mock('@/forest/quota/video-quota', () => ({
  reserveVideoSlot: vi.fn().mockResolvedValue({
    reserved: true,
    used: 1,
    limit: 1000,
    resetAt: '2026-06-01T00:00:00.000Z',
  }),
  releaseVideoSlot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/forest/missions/emit-video-generate', () => ({
  emitVideoGenerate: vi.fn().mockResolvedValue(undefined),
}));

// Mock createServerClient returning a fluent builder.
// insert returns { error: null } to simulate successful D1 insert.
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { generateVideoAction } from '../video-generate-action';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { reserveVideoSlot, releaseVideoSlot } from '@/forest/quota/video-quota';
import { emitVideoGenerate } from '@/forest/missions/emit-video-generate';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockReserveVideoSlot = vi.mocked(reserveVideoSlot);
const mockReleaseVideoSlot = vi.mocked(releaseVideoSlot);
const mockEmitVideoGenerate = vi.mocked(emitVideoGenerate);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateVideoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default mock implementations
    mockReserveVideoSlot.mockResolvedValue({
      reserved: true,
      used: 1,
      limit: 1000,
      resetAt: '2026-06-01T00:00:00.000Z',
    });
    mockEmitVideoGenerate.mockResolvedValue(undefined);
    mockReleaseVideoSlot.mockResolvedValue(undefined);
    // Return { error: null } to simulate a successful D1 insert
    mockInsert.mockResolvedValue({ error: null });
  });

  it('returns UNAUTHENTICATED when user is null', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await generateVideoAction({
      prompt: 'A beautiful sunset over the mountains',
      style: 'cinematic',
      language: 'en',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNAUTHENTICATED');
    }
  });

  it('returns AI_VIDEO_UNAVAILABLE when operator pipeline keys are missing', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'user',
    });
    const saved = process.env.WAN_API_KEY;
    delete process.env.WAN_API_KEY;

    try {
      const result = await generateVideoAction({
        prompt: 'A beautiful sunset over the mountains',
        style: 'cinematic',
        language: 'en',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('AI_VIDEO_UNAVAILABLE');
      }
      // Must short-circuit before quota or DB
      expect(mockReserveVideoSlot).not.toHaveBeenCalled();
    } finally {
      process.env.WAN_API_KEY = saved;
    }
  });

  it('returns VALIDATION_ERROR when prompt is too short', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'user',
    });

    const result = await generateVideoAction({
      prompt: 'short',
      style: 'casual',
      language: 'en',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns VALIDATION_ERROR when prompt is too long', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'user',
    });

    const result = await generateVideoAction({
      prompt: 'x'.repeat(501),
      style: 'casual',
      language: 'en',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns QUOTA_EXCEEDED when reservation fails', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'user',
    });
    mockReserveVideoSlot.mockResolvedValue({
      reserved: false,
      used: 30,
      limit: 30,
      resetAt: '2026-06-01T00:00:00.000Z',
    });

    const result = await generateVideoAction({
      prompt: 'A beautiful sunset over the mountains with clouds',
      style: 'cinematic',
      language: 'en',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('QUOTA_EXCEEDED');
    }
  });

  it('inserts mission row and emits event on success', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-abc',
      email: 'test@example.com',
      role: 'user',
    });

    const validInput = {
      prompt: 'A peaceful forest walk at dawn with birds singing',
      style: 'cinematic' as const,
      language: 'en' as const,
    };

    const result = await generateVideoAction(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.missionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }

    // Verify DB insert was called with correct schema columns (no tenant_id, no input)
    expect(mockFrom).toHaveBeenCalledWith('engine_missions');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-abc',
        status: 'pending',
        command: 'video.generate',
        params: expect.stringContaining('"prompt"'),
      }),
    );
    // Ensure banned columns are absent
    const insertPayload = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertPayload).not.toHaveProperty('tenant_id');
    expect(insertPayload).not.toHaveProperty('input');

    // Verify Inngest event was emitted
    expect(mockEmitVideoGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-abc',
        prompt: validInput.prompt,
        language: validInput.language,
      }),
    );
  });

  it('uses prompt as default voiceover text', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-abc',
      email: 'test@example.com',
      role: 'user',
    });

    const prompt = 'Explaining machine learning to beginners step by step';
    await generateVideoAction({ prompt, style: 'educational', language: 'vi' });

    expect(mockEmitVideoGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt,
        voiceoverText: prompt,
        language: 'vi',
      }),
    );
  });

  it('returns DB_ERROR and releases quota when insert fails', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-abc',
      email: 'test@example.com',
      role: 'user',
    });
    // Simulate D1 insert error
    mockInsert.mockResolvedValue({ error: { message: 'no such column: tenant_id' } });

    const result = await generateVideoAction({
      prompt: 'A beautiful sunset over the mountains',
      style: 'cinematic',
      language: 'en',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('DB_ERROR');
    }
    // Quota slot must be released on insert failure
    expect(mockReleaseVideoSlot).toHaveBeenCalledWith('user-abc');
    // Inngest event must NOT fire when insert failed
    expect(mockEmitVideoGenerate).not.toHaveBeenCalled();
  });
});
