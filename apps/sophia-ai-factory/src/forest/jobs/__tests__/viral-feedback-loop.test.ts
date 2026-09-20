/**
 * Unit Tests: Forest Viral Feedback Loop Job
 *
 * Validates:
 * 1. Orchestrated execution of runViralFeedbackSync
 * 2. Ingestion of video analytics records into learning loop
 * 3. Graceful handling of empty or unmigrated analytics tables
 *
 * Layer: forest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runViralFeedbackSync } from '../viral-feedback-loop';
import {
  registerCertification,
  ProviderCertificationState,
} from '@/seed/ai/provider-certification';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

function createMockD1(rows: unknown[] = []) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        all: async () => ({ results: rows, success: true }),
        run: async () => ({ success: true, meta: { changes: 1, duration: 1 } }),
        first: async () => null,
      })),
    })),
  } as unknown as D1Database;
}

describe('Viral Feedback Loop Job — forest/jobs/viral-feedback-loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs sync when video analytics rows exist and ingests feedback', async () => {
    const mockRows = [
      {
        video_id: 'vid_123',
        workspace_id: 'ws_test',
        platform: 'tiktok',
        views: 2000,
        watch_time_sec: 45,
        completion_rate: 0.75,
        shares: 50,
        likes: 120,
        comments: 15,
        impressions: 2500,
        clicks: 80,
        conversions: 8,
        synced_at: Date.now(),
      },
    ];

    const mockDb = createMockD1(mockRows);
    const result = await runViralFeedbackSync(mockDb);

    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('handles empty video_analytics table gracefully', async () => {
    const mockDb = createMockD1([]);
    const result = await runViralFeedbackSync(mockDb);

    expect(result.processed).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns D1_UNAVAILABLE error when no db binding is available', async () => {
    mocks.mockGetD1.mockResolvedValue(null);
    const result = await runViralFeedbackSync(undefined);
    expect(result.errors).toContain('D1_UNAVAILABLE');
    expect(result.processed).toBe(0);
  });

  it('actively diverts to openrouter when hermes is blocked by certification', async () => {
    registerCertification('hermes', {
      state: ProviderCertificationState.BLOCKED,
      security: 'BLOCKED',
      health: 'BLOCKED',
      canary: 'BLOCKED',
    });
    registerCertification('openrouter', {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
    });

    const mockDb = createMockD1([]);
    const result = await runViralFeedbackSync(mockDb);

    expect(result.activeProvider).toBe('openrouter');
    expect(result.providerDiverted).toBe(true);
  });

  it('fails safely when all fallback candidates are blocked', async () => {
    registerCertification('hermes', {
      state: ProviderCertificationState.BLOCKED,
      security: 'BLOCKED',
      health: 'BLOCKED',
      canary: 'BLOCKED',
    });
    registerCertification('openrouter', {
      state: ProviderCertificationState.BLOCKED,
      security: 'BLOCKED',
      health: 'BLOCKED',
      canary: 'BLOCKED',
    });
    registerCertification('anthropic', {
      state: ProviderCertificationState.BLOCKED,
      security: 'BLOCKED',
      health: 'BLOCKED',
      canary: 'BLOCKED',
    });

    const mockDb = createMockD1([]);
    const result = await runViralFeedbackSync(mockDb);

    expect(result.processed).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('PROVIDER_NOT_CERTIFIED');

    // Restore openrouter certification for other test runs
    registerCertification('openrouter', {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
    });
  });
});
