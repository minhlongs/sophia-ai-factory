/**
 * Unit tests for provider pool building — cost estimation, health score
 * resolution, and pool construction with mocked external dependencies.
 *
 * Pure functions (getProviderCost, estimateTaskCost) are tested directly.
 * buildProviderPool is tested with mocked BYOK, quota, and registry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VideoProvider, VideoTaskType } from '@/seed/config/routing-strategies';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('PREMIUM'),
}));

vi.mock('@/forest/quota/video-quota', () => ({
  checkVideoQuota: vi.fn().mockResolvedValue({ allowed: true, limit: 100, used: 10 }),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn().mockResolvedValue('resolved-key-abc'),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  getUserApiKey: vi.fn(),
}));

vi.mock('@/forest/ai/provider-factory', () => ({
  getSharedRegistry: vi.fn().mockReturnValue({
    getHealth: vi.fn().mockReturnValue({ healthy: true, inCooldown: false, unhealthy: false }),
  }),
}));

vi.mock('@/seed/utils/circuit-breaker', () => ({
  getCircuitState: vi.fn().mockResolvedValue({ state: 'closed', recentFailures: 0, recentSuccesses: 5 }),
}));

// Import after mocks are registered so vi.mock hoists
import {
  getProviderCost,
  estimateTaskCost,
  buildProviderPool,
} from '@/forest/quota/provider-pool';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { getCircuitState } from '@/seed/utils/circuit-breaker';

// ── Test data ──────────────────────────────────────────────────────────────

// Unserved-task penalty: cost-optimized strategy never picks these providers
const EXPECTED_UNSERVED_COST = 1_000_000;

type TaskProviderPair = { provider: VideoProvider; taskType: VideoTaskType; expectedCost: number };

const COST_CASES: TaskProviderPair[] = [
  { provider: 'openrouter', taskType: 'scripting', expectedCost: 0.002 },
  { provider: 'elevenlabs', taskType: 'tts', expectedCost: 0.0003 },
  { provider: 'd-id', taskType: 'visual', expectedCost: 0.015 },
  { provider: 'd-id', taskType: 'compose', expectedCost: 0.015 },
  { provider: 'heygen', taskType: 'visual', expectedCost: 0.02 },
  { provider: 'heygen', taskType: 'compose', expectedCost: 0.02 },
  // Unsupported pair → falls back to EXPECTED_UNSERVED_COST
  { provider: 'openrouter', taskType: 'tts', expectedCost: EXPECTED_UNSERVED_COST },
  { provider: 'elevenlabs', taskType: 'scripting', expectedCost: EXPECTED_UNSERVED_COST },
  { provider: 'heygen', taskType: 'tts', expectedCost: EXPECTED_UNSERVED_COST },
  { provider: 'd-id', taskType: 'scripting', expectedCost: EXPECTED_UNSERVED_COST },
  { provider: 'd-id', taskType: 'tts', expectedCost: EXPECTED_UNSERVED_COST },
];

// ── getProviderCost ────────────────────────────────────────────────────────

describe('getProviderCost', () => {
  it.each(COST_CASES)(
    '$provider/$taskType → $expectedCost',
    ({ provider, taskType, expectedCost }) => {
      expect(getProviderCost(provider, taskType)).toBe(expectedCost);
    },
  );

  it('returns EXPECTED_UNSERVED_COST for unsupported provider/task pair', () => {
    // openrouter has no tts cost defined
    expect(getProviderCost('openrouter', 'tts')).toBe(EXPECTED_UNSERVED_COST);
    expect(getProviderCost('heygen', 'tts')).toBe(EXPECTED_UNSERVED_COST);
  });
});

// ── estimateTaskCost ───────────────────────────────────────────────────────

describe('estimateTaskCost', () => {
  it('scales scripting cost by input tokens (cost is per 1K tokens)', () => {
    // openrouter/scripting: costPerUnit=0.002, formula = (0.002/1000) * tokens
    expect(estimateTaskCost('openrouter', 'scripting', 1000)).toBeCloseTo(0.002);
  });

  it('returns 0 for scripting with 0 tokens', () => {
    expect(estimateTaskCost('openrouter', 'scripting', 0)).toBe(0);
  });

  it('returns fixed cost for non-scripting tasks', () => {
    expect(estimateTaskCost('elevenlabs', 'tts', 5000)).toBeCloseTo(0.0003);
    expect(estimateTaskCost('elevenlabs', 'tts', 0)).toBeCloseTo(0.0003);
  });

  it('handles large token counts without overflow', () => {
    // 1M tokens: (0.002/1000) * 1_000_000 = 2.0
    const result = estimateTaskCost('openrouter', 'scripting', 1_000_000);
    expect(result).toBeCloseTo(2.0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('defaults to 1000 tokens when estimatedInputTokens is undefined', () => {
    expect(estimateTaskCost('openrouter', 'scripting')).toBeCloseTo(0.002);
  });
});

// ── buildProviderPool (mocked) ─────────────────────────────────────────────

describe('buildProviderPool', () => {
  const ENV_KEYS = ['OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY', 'DID_API_KEY', 'HEYGEN_API_KEY'] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.OPENROUTER_API_KEY = 'platform-or-key';
    process.env.ELEVENLABS_API_KEY = 'platform-eleven-key';
    process.env.DID_API_KEY = 'platform-did-key';
    process.env.HEYGEN_API_KEY = 'platform-heygen-key';
    getUserApiKey.mockResolvedValue('user-byok-key');
    getCircuitState.mockResolvedValue({ state: 'closed', recentFailures: 0, recentSuccesses: 5 });
    resolveUserApiKey.mockResolvedValue('resolved-key-abc');
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it('returns candidates with all required fields', async () => {
    const pool = await buildProviderPool('user-123', {
      taskType: 'scripting',
      estimatedInputTokens: 500,
    });

    expect(pool.length).toBeGreaterThan(0);
    for (const c of pool) {
      expect(c).toHaveProperty('provider');
      expect(c).toHaveProperty('model');
      expect(c).toHaveProperty('costPerUnit');
      expect(c).toHaveProperty('healthScore');
      expect(c).toHaveProperty('quotaRemaining');
      expect(c).toHaveProperty('usageCount');
      expect(c).toHaveProperty('estimatedCost');
      expect(c).toHaveProperty('hasUserKey');
      expect(c.healthScore).toBeGreaterThanOrEqual(0);
      expect(c.healthScore).toBeLessThanOrEqual(1);
    }
  });

  it('excludes providers with no key available', async () => {
    (resolveUserApiKey as ReturnType<typeof vi.fn>).mockImplementation(
      (_userId: string, provider: string) =>
        Promise.resolve(provider === 'openrouter' ? 'key' : null),
    );

    const pool = await buildProviderPool('user-123', {
      taskType: 'scripting',
      estimatedInputTokens: 500,
    });

    expect(pool.every((c) => c.provider === 'openrouter')).toBe(true);
  });

  it('returns empty pool when no keys are available', async () => {
    (resolveUserApiKey as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const pool = await buildProviderPool('user-123', {
      taskType: 'scripting',
      estimatedInputTokens: 500,
    });

    expect(pool).toEqual([]);
  });

  it('marks hasUserKey=true when user provides own key', async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockResolvedValue('my-custom-key');

    const pool = await buildProviderPool('user-123', {
      taskType: 'scripting',
      estimatedInputTokens: 500,
    });

    for (const c of pool) {
      expect(c.hasUserKey).toBe(true);
    }
  });

  it('marks hasUserKey=false when using platform fallback', async () => {
    (getUserApiKey as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const pool = await buildProviderPool('user-123', {
      taskType: 'tts',
      estimatedInputTokens: 500,
    });

    for (const c of pool) {
      expect(c.hasUserKey).toBe(false);
    }
  });

  it('applies circuit breaker open state for heygen', async () => {
    (getCircuitState as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'open',
      recentFailures: 10,
      recentSuccesses: 0,
    });

    const pool = await buildProviderPool('user-123', {
      taskType: 'visual',
      estimatedInputTokens: 100,
    });

    const heygen = pool.find((c) => c.provider === 'heygen');
    expect(heygen, 'heygen must be in visual pool').toBeDefined();
    expect(heygen!.healthScore).toBe(0.1);
  });

  it('applies circuit breaker half-open state for heygen', async () => {
    (getCircuitState as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'half-open',
      recentFailures: 5,
      recentSuccesses: 2,
    });

    const pool = await buildProviderPool('user-123', {
      taskType: 'visual',
      estimatedInputTokens: 100,
    });

    const heygen = pool.find((c) => c.provider === 'heygen');
    expect(heygen, 'heygen must be in visual pool').toBeDefined();
    expect(heygen!.healthScore).toBe(0.5);
  });

  it('calculates estimatedCost based on task type and tokens', async () => {
    const pool = await buildProviderPool('user-123', {
      taskType: 'scripting',
      estimatedInputTokens: 1000,
    });

    for (const c of pool) {
      expect(c.estimatedCost).toBeGreaterThanOrEqual(0);
      if (c.provider === 'openrouter') {
        // (0.002 / 1000) * 1000 = 0.002
        expect(c.estimatedCost).toBeCloseTo(0.002);
      }
    }
  });
});
