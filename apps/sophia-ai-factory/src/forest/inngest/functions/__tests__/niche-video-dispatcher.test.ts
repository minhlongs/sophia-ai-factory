/**
 * Niche Video Dispatcher Vitest Suite — runtime boundary.
 *
 * Proves the canonical render-queue producer: rejected CEX jurisdictions,
 * unverified offers staged as drafts, side-effect gate (tenant/approval/halt),
 * fail-closed voiceover, and the invariant that a manifest is NOT media.
 *
 * @module forest/inngest/functions/__tests__/niche-video-dispatcher.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type { SynthesizedCampaignScript } from '@/tree/video/render/niche-script-synthesizer';
import type { NicheRenderManifest } from '@/tree/video/render/niche-render-composer';

type StepRunFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
type EventData = {
  userId: string;
  tenantId?: string;
  offerId?: string;
  termsVerified?: boolean;
  approvalHash?: string;
  approvalId?: string;
  idempotencyKey?: string;
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
type InngestHandler = (ctx: {
  event: { data: EventData };
  step: { run: StepRunFn };
}) => Promise<{
  status?: string;
  state?: string;
  reason?: string;
  detail?: string;
  error?: unknown;
  planId?: string;
  summary?: Record<string, unknown>;
  plan?: NicheVideoCampaignPlan;
  script?: SynthesizedCampaignScript;
  manifest?: NicheRenderManifest;
  manifestIsMedia?: boolean;
  mediaReady?: boolean;
  artifactId?: string | null;
  nextAction?: string;
  approvalPayloadHash?: string;
}>;

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: InngestHandler,
    ) => ({ id: 'niche-video-dispatcher', _handler: handler }),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/security/approval-payload-hash', () => ({
  computeApprovalPayloadHash: vi.fn(async () => 'hash-v1'),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => null),
  createServerClient: vi.fn(),
}));

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  isAffiliateKillSwitchActive: vi.fn(async () => false),
  getAffiliateKillSwitchState: vi.fn(async () => ({ active: false, known: true })),
}));

vi.mock('@/tree/affiliate/approval/campaign-approval-repo', () => ({
  createCampaignApproval: vi.fn(async () => ({ ok: true, value: { id: 'app_1' } })),
  verifyAndEnforceCampaignApprovalD1: vi.fn(async () => ({ ok: true, value: { verifiedHash: 'hash-v1' } })),
}));

vi.mock('@/tree/video/render', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tree/video/render')>();
  return {
    ...actual,
    generateNicheCampaignVoiceover: vi.fn(async () => ({
      success: true,
      provider: 'elevenlabs' as const,
      audioUrl: 'https://fixtures.local/audio.mp3',
      durationSec: 12,
    })),
  };
});

import { nicheVideoDispatcher } from '../niche-video-dispatcher';
import { generateNicheCampaignVoiceover } from '@/tree/video/render';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';

function getHandler(): InngestHandler {
  return (nicheVideoDispatcher as unknown as { _handler: InngestHandler })._handler;
}

const mockStep = {
  run: (async <T>(_name: string, fn: () => Promise<T>): Promise<T> => await fn()) as StepRunFn,
};

function saasEvent(overrides: Partial<EventData> = {}): { data: EventData } {
  return {
    data: {
      userId: 'usr_agency_2',
      tenantId: 'ws_a',
      offerId: 'offer_1',
      termsVerified: true,
      approvalHash: 'hash-v1',
      idempotencyKey: 'ws_a:plan_1',
      niche: 'saas_global' as const,
      blueprintId: 'saas_problem_agitation_solution',
      productName: 'FlowCraft AI',
      productUrl: 'https://grsm.io/flowcraft',
      jurisdiction: 'GLOBAL',
      affiliateCode: 'SOPHIA_VIP',
      subId: 'yt_short_10',
      vanityCoupon: 'SAVE30',
      locale: 'en' as const,
      ...overrides,
    },
  };
}

describe('nicheVideoDispatcher Inngest Function (canonical render queue)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({ active: false, known: true });
    vi.mocked(generateNicheCampaignVoiceover).mockResolvedValue({
      success: true,
      provider: 'elevenlabs',
      audioUrl: 'https://fixtures.local/audio.mp3',
      durationSec: 12,
    });
  });

  it('rejects a banned CEX jurisdiction before any side effect', async () => {
    const result = await getHandler()({
      event: {
        data: {
          userId: 'usr_agency_1',
          niche: 'crypto_global',
          blueprintId: 'crypto_fee_discount_signup_bonus',
          productName: 'Bybit',
          productUrl: 'https://bybit.com/register',
          jurisdiction: 'VN',
        },
      },
      step: mockStep,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.state).toBe('blocked');
    expect(result.error).toMatchObject({ code: 'VIETNAM_PROMOTIONAL_BAN' });
    expect(generateNicheCampaignVoiceover).not.toHaveBeenCalled();
  });

  it('stages an unverified offer / unknown jurisdiction as a draft without spending', async () => {
    const unknown = await getHandler()({ event: saasEvent({ termsVerified: false }), step: mockStep });
    expect(unknown.status).toBe('DRAFT_PENDING_CEO_APPROVAL');
    expect(unknown.state).toBe('approval_pending');
    expect(unknown.mediaReady).toBe(false);
    expect(generateNicheCampaignVoiceover).not.toHaveBeenCalled();

    const unknownJurisdiction = await getHandler()({
      event: {
        data: {
          userId: 'usr_x', tenantId: 'ws_a', niche: 'crypto_global',
          blueprintId: 'crypto_fee_discount_signup_bonus', productName: 'Bybit',
          productUrl: 'https://bybit.com/register', jurisdiction: 'GLOBAL',
          termsVerified: true,
        },
      },
      step: mockStep,
    });
    // Either rejected or staged as a draft is correct; spending is not.
    expect(['REJECTED', 'DRAFT_PENDING_CEO_APPROVAL']).toContain(unknownJurisdiction.status);
    expect(generateNicheCampaignVoiceover).not.toHaveBeenCalled();
  });

  it('blocks when no server-resolved tenant is present', async () => {
    const result = await getHandler()({ event: saasEvent({ tenantId: undefined }), step: mockStep });
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('TENANT_REQUIRED');
    expect(generateNicheCampaignVoiceover).not.toHaveBeenCalled();
  });

  it('blocks when the approved payload hash changed after approval', async () => {
    const result = await getHandler()({ event: saasEvent({ approvalHash: 'hash-v2' }), step: mockStep });
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('APPROVAL_INVALIDATED');
    expect(generateNicheCampaignVoiceover).not.toHaveBeenCalled();
  });

  it('blocks when the kill switch is active (re-checked at the side-effect boundary)', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({ active: true, known: true });
    const result = await getHandler()({ event: saasEvent(), step: mockStep });
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('KILL_SWITCH_ACTIVE');
    expect(generateNicheCampaignVoiceover).not.toHaveBeenCalled();
  });

  it('fails closed when TTS fails — no manifest is emitted', async () => {
    vi.mocked(generateNicheCampaignVoiceover).mockResolvedValue({
      success: false,
      provider: 'mock',
      error: 'ElevenLabs BYOK missing',
    });
    const result = await getHandler()({ event: saasEvent(), step: mockStep });
    expect(result.status).toBe('FAILED');
    expect(result.state).toBe('failed');
    expect(result.reason).toBe('PROVIDER_UNAVAILABLE');
    expect(result.manifest).toBeUndefined();
    expect(result.mediaReady).toBe(false);
  });

  it('queues a compliant SaaS campaign as a manifest only — never RENDER_READY/media', async () => {
    const result = await getHandler()({ event: saasEvent(), step: mockStep });

    expect(result.status).toBe('RENDER_QUEUED');
    expect(result.state).toBe('render_queued');
    expect(result.mediaReady).toBe(false);
    expect(result.manifestIsMedia).toBe(false);
    expect(result.artifactId).toBeNull();
    expect(result.nextAction).toBe('render_worker');
    expect(result.plan?.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
    expect(result.summary?.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
    expect(result.script?.scenes.length).toBe(5);
    expect(result.manifest?.resolution).toEqual({ width: 1080, height: 1920 });
    expect(result.manifest?.ffmpegFilter).toContain('Disclosure: Partner Link');
  });

  it('queues a compliant CEX campaign with the regulatory overlay spec', async () => {
    const result = await getHandler()({
      event: {
        data: {
          userId: 'usr_agency_3', tenantId: 'ws_a', offerId: 'offer_cex',
          termsVerified: true, approvalHash: 'hash-v1',
          niche: 'crypto_global', blueprintId: 'crypto_fee_discount_signup_bonus',
          productName: 'Binance', productUrl: 'https://accounts.binance.com/register',
          jurisdiction: 'US', affiliateCode: 'BINANCE20', locale: 'en',
        },
      },
      step: mockStep,
    });

    expect(result.status).toBe('RENDER_QUEUED');
    expect(result.plan?.overlaySpec).toBeDefined();
    expect(result.manifest?.audio.backgroundMusicDuckingDb).toBe(-18);
    expect(result.manifest?.ffmpegFilter).toContain('drawtext');
    expect(result.mediaReady).toBe(false);
  });
});
