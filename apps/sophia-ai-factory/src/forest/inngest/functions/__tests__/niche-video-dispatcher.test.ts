/**
 * Niche Video Dispatcher Vitest Suite
 *
 * Verifies Inngest function steps:
 * 1. Jurisdiction compliance evaluation & storyboard generation
 * 2. Rejection handling when compliance fails
 * 3. Video payload staging when campaign is approved
 * 4. Synthesizes scene-by-scene script
 * 5. Generates voiceover
 * 6. Assembles complete render manifest
 *
 * @module forest/inngest/functions/__tests__/niche-video-dispatcher.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type { SynthesizedCampaignScript } from '@/tree/video/render/niche-script-synthesizer';
import type { NicheRenderManifest } from '@/tree/video/render/niche-render-composer';

type StepRunFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
type InngestHandler = (ctx: {
  event: {
    data: {
      userId: string;
      niche: 'saas_global' | 'crypto_global';
      blueprintId: string;
      productName: string;
      productUrl: string;
      targetAudience?: string;
      jurisdiction?: string;
      affiliateCode?: string;
      subId?: string | null;
      vanityCoupon?: string | null;
      locale?: 'en' | 'vi';
    };
  };
  step: { run: StepRunFn };
}) => Promise<{
  status?: string;
  error?: unknown;
  planId?: string;
  summary?: Record<string, unknown>;
  plan?: NicheVideoCampaignPlan;
  script?: SynthesizedCampaignScript;
  manifest?: NicheRenderManifest;
}>;

const captured = vi.hoisted(() => ({
  handler: undefined as InngestHandler | undefined,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: InngestHandler,
    ) => {
      captured.handler = handler;
      return { id: 'niche-video-dispatcher', _handler: handler };
    },
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { nicheVideoDispatcher } from '../niche-video-dispatcher';

function getHandler(): InngestHandler {
  return (nicheVideoDispatcher as unknown as { _handler: InngestHandler })._handler;
}

describe('nicheVideoDispatcher Inngest Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStep = {
    run: (async <T>(_name: string, fn: () => Promise<T>): Promise<T> => {
      return await fn();
    }) as StepRunFn,
  };

  it('rejects campaign when jurisdiction compliance fails', async () => {
    const handler = getHandler();
    expect(handler).toBeDefined();

    const event = {
      data: {
        userId: 'usr_agency_1',
        niche: 'crypto_global' as const,
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Bybit',
        productUrl: 'https://bybit.com/register',
        jurisdiction: 'VN',
      },
    };

    const result = await handler({ event, step: mockStep });

    expect(result.status).toBe('REJECTED');
    expect(result.error).toMatchObject({
      code: 'VIETNAM_PROMOTIONAL_BAN',
    });
  });

  it('processes, synthesizes and stages compliant SaaS video campaign', async () => {
    const handler = getHandler();
    expect(handler).toBeDefined();

    const event = {
      data: {
        userId: 'usr_agency_2',
        niche: 'saas_global' as const,
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'https://grsm.io/flowcraft',
        jurisdiction: 'GLOBAL',
        affiliateCode: 'SOPHIA_VIP',
        subId: 'yt_short_10',
        vanityCoupon: 'SAVE30',
        locale: 'en' as const,
      },
    };

    const result = await handler({ event, step: mockStep });

    expect(result.status).toBe('RENDER_READY');
    expect(result.plan?.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
    expect(result.summary?.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
    expect(result.script).toBeDefined();
    expect(result.script?.scenes.length).toBe(5);
    expect(result.manifest).toBeDefined();
    expect(result.manifest?.resolution).toEqual({ width: 1080, height: 1920 });
    expect(result.manifest?.ffmpegFilter).toContain('Disclosure: Partner Link');
  });

  it('processes and stages compliant Crypto campaign with overlay spec & audio ducking', async () => {
    const handler = getHandler();
    expect(handler).toBeDefined();

    const event = {
      data: {
        userId: 'usr_agency_3',
        niche: 'crypto_global' as const,
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Binance',
        productUrl: 'https://accounts.binance.com/register',
        jurisdiction: 'US',
        affiliateCode: 'BINANCE20',
        locale: 'en' as const,
      },
    };

    const result = await handler({ event, step: mockStep });

    expect(result.status).toBe('RENDER_READY');
    expect(result.plan?.planId).toBeDefined();
    expect(result.plan?.overlaySpec).toBeDefined();
    expect(result.manifest?.audio.backgroundMusicDuckingDb).toBe(-18);
    expect(result.manifest?.ffmpegFilter).toContain('drawtext');
  });
});
