import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildBayesianScriptContext,
  getScriptSteeringForUser,
} from '../prior-script-bridge';
import * as clientModule from '@/seed/db/client';

describe('Land Layer: Prior-to-Script Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to default uninformative priors when database is unavailable', async () => {
    vi.spyOn(clientModule, 'getD1').mockResolvedValue(null);

    const context = await buildBayesianScriptContext('user-1', 'Crypto Trading', 'Beginners');

    expect(context.userId).toBe('user-1');
    expect(context.topic).toBe('Crypto Trading');
    expect(context.audience).toBe('Beginners');
    expect(context.priors.hookAlpha).toBe(2.0);
    expect(context.priors.hookBeta).toBe(2.0);
    expect(context.priors.expectedHookRetention).toBe(0.5);
    expect(context.steering.targetHookDropoffThreshold).toBe(25);
  });

  it('aggregates D1 priors and winning MAB arm correctly', async () => {
    const mockPriors = [
      { dimension_key: 'hook', dimension_val: 'visual', alpha: 12, beta: 3, sample_size: 15 },
      { dimension_key: 'retention', dimension_val: 'tiktok', alpha: 8, beta: 2, sample_size: 10 },
    ];

    const mockWinningArm = {
      variant_name: 'Shock-and-Awe Question',
      conversion_count: 42,
    };

    const mockD1 = {
      prepare: vi.fn((query: string) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (query.includes('growth_bayesian_priors')) {
              return { results: mockPriors };
            }
            return { results: [] };
          }),
          first: vi.fn(async () => {
            if (query.includes('growth_bandit_arms')) {
              return mockWinningArm;
            }
            return null;
          }),
        })),
        all: vi.fn(async () => ({ results: [] })),
        first: vi.fn(async () => mockWinningArm),
      })),
    };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockD1 as unknown as Awaited<ReturnType<typeof clientModule.getD1>>);

    const context = await buildBayesianScriptContext('user-pro', 'SaaS Growth', 'Founders');

    expect(context.userId).toBe('user-pro');
    expect(context.priors.hookAlpha).toBe(12);
    expect(context.priors.hookBeta).toBe(3);
    expect(context.priors.sampleSize).toBe(25);
    expect(context.priors.expectedHookRetention).toBe(0.8);
    expect(context.steering.winningHookArchetype).toBe('Shock-and-Awe Question');
    expect(context.steering.targetHookDropoffThreshold).toBe(30);

    const directSteering = await getScriptSteeringForUser('user-pro', 'SaaS Growth', 'Founders');
    expect(directSteering.winningHookArchetype).toBe('Shock-and-Awe Question');
  });
});
