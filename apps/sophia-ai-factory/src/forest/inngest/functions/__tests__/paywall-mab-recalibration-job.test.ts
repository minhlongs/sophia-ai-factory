/**
 * @file paywall-mab-recalibration-job.test.ts
 * @description Unit tests for Paywall MAB Recalibration Job with Track B Sparse-Data Guard
 * @layer forest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRun = vi.fn().mockReturnValue({ meta: { changes: 1 } });
const mockAll = vi.fn();
const mockBind = vi.fn().mockReturnValue({
  run: mockRun,
  all: mockAll,
});
const mockPrepare = vi.fn().mockReturnValue({
  bind: mockBind,
});

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    prepare: mockPrepare,
  })),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}));

import { paywallMabRecalibrationJob } from '../paywall-mab-recalibration-job';

interface MockedInngestFunction {
  handler: (ctx: {
    event: {
      data: {
        campaignId: string;
        winningArmId: string;
        priceUsd: number;
        expectedRevenue: number;
        accountAgeDays?: number;
      };
    };
    step: {
      run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => Promise<{
    success: boolean;
    campaignId: string;
    winningArmId: string;
    recalibrated: boolean;
    mode: string;
  }>;
}

describe('paywallMabRecalibrationJob (Track B Sparse-Data Guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('holds MAB recalibration when active arms are below sparse-data threshold', async () => {
    mockAll.mockResolvedValue({
      results: [
        {
          id: 'arm-1',
          campaignId: 'camp-sparse',
          priceTier: 'BASIC',
          priceUsd: 199,
          alphaSuccess: 4,
          betaFailure: 46,
          impressions: 50,
          conversions: 4,
          revenueUsd: 796,
          isActive: 1,
        },
        {
          id: 'arm-2',
          campaignId: 'camp-sparse',
          priceTier: 'PREMIUM',
          priceUsd: 399,
          alphaSuccess: 2,
          betaFailure: 48,
          impressions: 50,
          conversions: 2,
          revenueUsd: 798,
          isActive: 1,
        },
      ],
    });

    const job = paywallMabRecalibrationJob as unknown as MockedInngestFunction;
    const res = await job.handler({
      event: {
        data: {
          campaignId: 'camp-sparse',
          winningArmId: 'arm-1',
          priceUsd: 199,
          expectedRevenue: 796,
        },
      },
      step: {
        run: async (_name, fn) => fn(),
      },
    });

    expect(res.success).toBe(true);
    expect(res.recalibrated).toBe(false);
    expect(res.mode).toBe('deterministic_rule_based');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('executes MAB recalibration when >=100 conversions and >=1,000 impressions per arm', async () => {
    mockAll.mockResolvedValue({
      results: [
        {
          id: 'arm-1',
          campaignId: 'camp-dense',
          priceTier: 'BASIC',
          priceUsd: 199,
          alphaSuccess: 55,
          betaFailure: 1145,
          impressions: 1200,
          conversions: 55,
          revenueUsd: 10945,
          isActive: 1,
        },
        {
          id: 'arm-2',
          campaignId: 'camp-dense',
          priceTier: 'PREMIUM',
          priceUsd: 399,
          alphaSuccess: 65,
          betaFailure: 1135,
          impressions: 1200,
          conversions: 65,
          revenueUsd: 25935,
          isActive: 1,
        },
      ],
    });

    const job = paywallMabRecalibrationJob as unknown as MockedInngestFunction;
    const res = await job.handler({
      event: {
        data: {
          campaignId: 'camp-dense',
          winningArmId: 'arm-2',
          priceUsd: 399,
          expectedRevenue: 25935,
          accountAgeDays: 45,
        },
      },
      step: {
        run: async (_name, fn) => fn(),
      },
    });

    expect(res.success).toBe(true);
    expect(res.recalibrated).toBe(true);
    expect(res.mode).toBe('thompson_half_kelly');
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
