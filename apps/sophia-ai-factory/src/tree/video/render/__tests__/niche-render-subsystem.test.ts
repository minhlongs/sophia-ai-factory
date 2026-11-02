/**
 * Niche Video Render Subsystem Tests
 *
 * Verifies script synthesis, visual asset generation,
 * voiceover fallback, and manifest FFmpeg composition.
 *
 * @module tree/video/render/__tests__/niche-render-subsystem.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import {
  synthesizeNicheScript,
  generateSceneVisualAssets,
  composeNicheRenderManifest,
  generateNicheCampaignVoiceover,
} from '../index';

describe('Niche Video Render Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const samplePlanInput = {
    niche: 'saas_global' as const,
    blueprintId: 'saas_problem_agitation_solution',
    productName: 'Linear App',
    productUrl: 'https://linear.app',
    targetAudience: 'Software Engineers',
    jurisdiction: 'GLOBAL',
    affiliateCode: 'DEV_HERO',
    subId: 'aff_tiktok_01',
    locale: 'en' as const,
  };

  const planResult = createNicheVideoCampaignPlan(samplePlanInput);
  if (!planResult.ok) {
    throw new Error('Failed to create test plan');
  }
  const testPlan = planResult.value;

  it('synthesizes scene-by-scene script with timing and narration', () => {
    const script = synthesizeNicheScript(testPlan);

    expect(script.planId).toBe(testPlan.planId);
    expect(script.productName).toBe('Linear App');
    expect(script.scenes.length).toBe(5);
    expect(script.totalDurationSec).toBe(60);

    const hookScene = script.scenes[0];
    expect(hookScene.role).toBe('hook');
    expect(hookScene.durationSec).toBe(3);
    expect(hookScene.narrationText).toContain('Linear App');
    expect(hookScene.visualPrompt).toContain('Minimalist Dark UI');

    const ctaScene = script.scenes[4];
    expect(ctaScene.role).toBe('cta');
    expect(ctaScene.durationSec).toBe(12);
    expect(ctaScene.onScreenText).toBeDefined();
  });

  it('generates 9:16 vertical visual asset specifications', () => {
    const script = synthesizeNicheScript(testPlan);
    const visualsResult = generateSceneVisualAssets(testPlan.planId, script.scenes);

    expect(visualsResult.planId).toBe(testPlan.planId);
    expect(visualsResult.totalScenes).toBe(5);

    const hookAsset = visualsResult.assets[0];
    expect(hookAsset.aspectRatio).toBe('9:16');
    expect(hookAsset.transition).toBe('zoom_in');
    expect(hookAsset.prompt).toContain('vertical orientation 9:16');
    expect(hookAsset.prompt).toContain('1080x1920');

    const ctaAsset = visualsResult.assets[4];
    expect(ctaAsset.transition).toBe('fade');
  });

  it('composes render manifest with compliance disclaimer filter', () => {
    const script = synthesizeNicheScript(testPlan);
    const visualsResult = generateSceneVisualAssets(testPlan.planId, script.scenes);

    const manifest = composeNicheRenderManifest({
      plan: testPlan,
      script,
      visuals: visualsResult.assets,
    });

    expect(manifest.manifestId).toMatch(/^mnf_[a-f0-9]{16}$/);
    expect(manifest.planId).toBe(testPlan.planId);
    expect(manifest.resolution).toEqual({ width: 1080, height: 1920 });
    expect(manifest.fps).toBe(30);
    expect(manifest.scenes.length).toBe(5);
    expect(manifest.audio.backgroundMusicDuckingDb).toBe(-12);
    expect(manifest.ffmpegFilter).toContain('Disclosure: Partner Link');
    expect(manifest.trackedUrl).toContain('ref=DEV_HERO');
    expect(manifest.trackedUrl).toContain('sub_id=aff_tiktok_01');
  });

  it('fails closed with CREDENTIALS_MISSING when no workspace ElevenLabs BYOK key exists', async () => {
    const voiceoverResult = await generateNicheCampaignVoiceover(
      {
        planId: testPlan.planId,
        userId: 'usr_test_voice',
        tenantId: 'ws_no_key',
        narrationText: 'Check out this software product today.',
        locale: 'en',
      },
      {
        resolveByokKey: async () => null,
      },
    );

    expect(voiceoverResult.success).toBe(false);
    expect(voiceoverResult.errorCode).toBe('CREDENTIALS_MISSING');
    expect(voiceoverResult.providerRequestDispatched).toBe(false);
    expect(voiceoverResult.outcomeUncertain).toBe(false);
  });

  it('resolves tenant/user BYOK key and never accepts mock audio as live ElevenLabs output', async () => {
    const mockAttempt = await generateNicheCampaignVoiceover(
      {
        planId: testPlan.planId,
        userId: 'usr_test_voice',
        tenantId: 'ws_tenant_a',
        narrationText: 'Check out this software product today.',
        locale: 'en',
      },
      {
        resolveByokKey: async (ownerId) => (ownerId === 'ws_tenant_a' ? 'el_byok_tenant_a' : null),
        synthesize: async () => ({
          audio_url: 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
          duration: 5,
          provider: 'mock',
          isMock: true,
        }),
      },
    );

    expect(mockAttempt.success).toBe(false);
    expect(mockAttempt.errorCode).toBe('MOCK_OUTPUT_REJECTED');
    expect(mockAttempt.outcomeUncertain).toBe(false);

    let capturedKey: string | null = null;
    const liveSuccess = await generateNicheCampaignVoiceover(
      {
        planId: testPlan.planId,
        userId: 'usr_without_personal_key',
        tenantId: 'ws_tenant_a',
        narrationText: 'Check out this software product today.',
        locale: 'en',
      },
      {
        resolveByokKey: async (ownerId) => (ownerId === 'ws_tenant_a' ? 'el_byok_tenant_a' : null),
        synthesize: async (_input, synthDeps) => {
          capturedKey = (await synthDeps?.resolveApiKey?.('ws_tenant_a', 'elevenlabs')) ?? null;
          return {
            audio_url: 'https://r2.sophia.local/tenants/ws_tenant_a/audio/vo_1.mp3',
            duration: 14,
            provider: 'elevenlabs',
            isMock: false,
          };
        },
      },
    );

    expect(capturedKey).toBe('el_byok_tenant_a');
    expect(liveSuccess.success).toBe(true);
    expect(liveSuccess.provider).toBe('elevenlabs');
    expect(liveSuccess.audioUrl).toContain('ws_tenant_a');
    expect(liveSuccess.outcomeUncertain).toBe(false);
  });

  it('classifies ElevenLabs timeout/network failure as outcomeUncertain=true and auth/quota failure as outcomeUncertain=false', async () => {
    const timeoutRes = await generateNicheCampaignVoiceover(
      {
        planId: testPlan.planId,
        userId: 'usr_test_voice',
        tenantId: 'ws_tenant_a',
        narrationText: 'Check out this software product today.',
      },
      {
        resolveByokKey: async () => 'el_byok_tenant_a',
        synthesize: async () => {
          throw new Error('Request timed out after 15000ms');
        },
      },
    );
    expect(timeoutRes.success).toBe(false);
    expect(timeoutRes.errorCode).toBe('PROVIDER_TIMEOUT');
    expect(timeoutRes.providerRequestDispatched).toBe(true);
    expect(timeoutRes.outcomeUncertain).toBe(true);

    const authRes = await generateNicheCampaignVoiceover(
      {
        planId: testPlan.planId,
        userId: 'usr_test_voice',
        tenantId: 'ws_tenant_a',
        narrationText: 'Check out this software product today.',
      },
      {
        resolveByokKey: async () => 'el_byok_tenant_a',
        synthesize: async () => {
          throw new Error('ElevenLabs API failed: 401 - Unauthorized invalid key');
        },
      },
    );
    expect(authRes.success).toBe(false);
    expect(authRes.errorCode).toBe('PROVIDER_AUTH_FAILED');
    expect(authRes.outcomeUncertain).toBe(false);
  });
});
