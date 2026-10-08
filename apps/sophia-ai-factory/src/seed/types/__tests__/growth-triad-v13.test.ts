import { describe, it, expect } from 'vitest';
import {
  banditArmSchema,
  banditExperimentSchema,
  lensEvaluationSchema,
  creativeDeliberationReportSchema,
  touchpointRecordSchema,
  shapleyAttributionItemSchema,
  shapleyAttributionResultSchema,
} from '../growth-triad-v13';

describe('Growth Triad v13 Seed Types & Zod Schemas', () => {
  it('validates a valid bandit arm schema', () => {
    const validArm = {
      id: 'arm-1',
      experimentId: 'exp-1',
      hookText: 'Stop making this mistake with AI videos',
      alphaSuccesses: 5,
      betaFailures: 10,
      pullCount: 15,
      conversionCount: 5,
      trafficWeight: 0.35,
      status: 'ACTIVE',
    };
    expect(banditArmSchema.safeParse(validArm).success).toBe(true);
  });

  it('rejects an invalid bandit arm with negative alpha', () => {
    const invalidArm = {
      id: 'arm-2',
      experimentId: 'exp-1',
      hookText: 'Hook',
      alphaSuccesses: -1,
      betaFailures: 5,
      pullCount: 4,
      conversionCount: 0,
      trafficWeight: 0.1,
      status: 'ACTIVE',
    };
    expect(banditArmSchema.safeParse(invalidArm).success).toBe(false);
  });

  it('validates a full bandit experiment schema', () => {
    const validExp = {
      id: 'exp-1',
      userId: 'user-123',
      experimentName: 'TikTok Hook Matrix v13',
      status: 'ACTIVE',
      totalPulls: 100,
      arms: [
        {
          id: 'arm-1',
          experimentId: 'exp-1',
          hookText: 'Hook A test text',
          alphaSuccesses: 10,
          betaFailures: 40,
          pullCount: 50,
          conversionCount: 10,
          trafficWeight: 0.5,
          status: 'ACTIVE',
        },
      ],
      convergenceThreshold: 0.95,
      minPullsBeforeConvergence: 50,
    };
    expect(banditExperimentSchema.safeParse(validExp).success).toBe(true);
  });

  it('validates creative deliberation report schema', () => {
    const validReport = {
      scriptId: 'script-1',
      userId: 'user-123',
      originalScript: 'This is the full hook and script for the automated video.',
      compositeScore: 82.5,
      verdict: 'APPROVED',
      evaluations: [
        {
          lens: 'HOOK_ANALYST',
          score: 85,
          feedback: 'High engagement curiosity gap.',
        },
        {
          lens: 'RETENTION_CRITIC',
          score: 80,
          feedback: 'Pacing drops slightly around second 15.',
        },
        {
          lens: 'COMPLIANCE_GUARD',
          score: 82.5,
          feedback: 'Zero banned keywords or misleading claims.',
        },
      ],
    };
    expect(creativeDeliberationReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('validates shapley attribution schema', () => {
    const validResult = {
      conversionId: 'conv-999',
      totalGrossRevenueUsd: 150.0,
      totalCommissionUsd: 60.0,
      touchpoints: [
        {
          videoManifestId: 'vid-1',
          channelId: 'chan-1',
          platform: 'YOUTUBE_SHORTS',
          shapleyWeight: 0.4,
          attributedRevenueUsd: 60.0,
          mcuCostUsd: 0.5,
          netProfitUsd: 59.5,
          roas: 120.0,
        },
        {
          videoManifestId: 'vid-2',
          channelId: 'chan-2',
          platform: 'TIKTOK_V2',
          shapleyWeight: 0.6,
          attributedRevenueUsd: 90.0,
          mcuCostUsd: 0.5,
          netProfitUsd: 89.5,
          roas: 180.0,
        },
      ],
      overallRoas: 150.0,
    };
    expect(shapleyAttributionResultSchema.safeParse(validResult).success).toBe(true);
  });
});
