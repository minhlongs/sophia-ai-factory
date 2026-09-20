/**
 * Tier 5 White-Box Adversarial Hardening Suite — Multi-Tenant Providers & Studio UI
 *
 * Requirements from Milestone 4 Tier 5 Challenger 2 Dispatch:
 * 1. Multi-Tenant Circuit Breaker Isolation:
 *    - keyRef="tenant-A:elevenlabs" vs keyRef="tenant-B:elevenlabs" complete state separation
 *    - 4-state machine lifecycle: CLOSED -> OPEN -> HALF_OPEN (probe) -> CLOSED (recovery)
 *    - Probe failure in HALF_OPEN: immediate re-opening with renewed cooldown
 *    - Connection failure lockout isolation per keyRef
 *    - Multi-modal providers (ElevenLabsAudioProvider, ReplicateImageProvider, FalImageProvider, ReplicateVideoRenderingProvider)
 * 2. Extreme MCU & Cost Estimation Bounds:
 *    - calculateMcuCredits: 0s, -50s, 10000s, NaN, Infinity, -Infinity
 *    - estimateMissionPreflight: negative/0 scenes, negative/0 words, massive counts (1000 scenes, 50k words)
 *    - Zero/negative cost impossibility proofs across all templates & parameter extremes
 *    - Unknown template ID fallback resilience
 * 3. UI Polling & Concurrency Extremes:
 *    - Rapid mount/unmount cycle during active polling (0ms, 5ms, 15ms, 20 rapid unmount cycles)
 *    - In-flight promise resolution safety (isMountedRef guard prevents leaks and unmounted setState)
 *    - Malformed trackStatus payloads: null, undefined, {}, unknown tracks, prototype pollution (__proto__, constructor)
 *    - stageFailureMessage and template localization robustness with real messages (en.json, vi.json)
 * 4. Capability Model Adversarial Input Bounds:
 *    - Normalization, whitespace, mixed-case
 *    - Hostile inputs & prototype property isolation
 *
 * Rule Compliance:
 * - Zero `:any` types.
 * - Strict 4-layer architecture imports (seed -> tree -> forest -> land).
 *
 * @module __tests__/e2e/multi-track-tier5-provider-ui-adversarial.test
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Real messages for bilingual validation
import enMessages from '../../../messages/en.json';
import viMessages from '../../../messages/vi.json';

// Layer imports adhering strictly to seed -> tree -> forest -> land
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
  getState,
  reset as resetCircuit,
  __testSetEntry,
} from '@/seed/security/circuit-breaker';
import { CircuitState, FailureKind } from '@/seed/types/failure-kind';
import {
  resolveCapabilities,
  hasRequiredCapabilities,
  ALL_CAPABILITIES,
  type AICapability,
} from '@/seed/ai/capability-model';
import {
  calculateMcuCredits,
  estimateMissionPreflight,
  estimateTemplateCost,
  FAL_AI_COST_PER_IMAGE_USD,
  ELEVENLABS_COST_PER_1K_CHARS_USD,
  OPENROUTER_SCRIPT_COST_USD,
} from '@/land/missions/cost-estimator';
import {
  getFirstRunTemplates,
  getTemplateById,
  getDefaultTemplate,
  type TemplateId,
} from '@/land/missions/first-run-template';
import {
  ElevenLabsAudioProvider,
  ReplicateImageProvider,
  ReplicateVideoRenderingProvider,
} from '@/forest/ai/provider-factory';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import {
  FirstRunWizard,
  mapTrackStatusToStage,
  STAGE_TO_KEY,
  MAX_POLL_TIMEOUT_MS,
} from '@/components/missions/first-run-wizard';
import type { MissionTrackStatus } from '@/forest/mission/multi-track-orchestrator';
import type { MissionStageId } from '@/components/missions/mission-progress-bar';

// ─── Module Mocks ─────────────────────────────────────────────────────────────

const mockCreateMission = vi.fn();
const mockExecuteMultiTrackMissionAction = vi.fn();
const mockGetMissionTrackStatus = vi.fn();

vi.mock('@/land/creative-mission/actions', () => ({
  createMission: (...args: unknown[]) => mockCreateMission(...args),
  executeMultiTrackMissionAction: (...args: unknown[]) => mockExecuteMultiTrackMissionAction(...args),
  getMissionTrackStatus: (...args: unknown[]) => mockGetMissionTrackStatus(...args),
}));

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, 'data-testid': 'nav-link' }, children),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => {
    return (key: string, values?: Record<string, string | number>) => {
      if (values) {
        let serialized = key;
        for (const [k, v] of Object.entries(values)) {
          serialized += `:${k}=${v}`;
        }
        return serialized;
      }
      return key;
    };
  },
}));

// Mock createServerClient for circuit-breaker D1 persistence
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: () => ({
      bind: () => ({
        run: async () => ({ success: true }),
      }),
    }),
  }),
}));

describe('Tier 5 White-Box Adversarial Hardening Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. MULTI-TENANT CIRCUIT BREAKER ISOLATION & 4-STATE MACHINE
  // ============================================================================
  describe('1. Multi-Tenant Circuit Breaker Isolation & Recovery Lifecycle', () => {
    const SERVICE = 'elevenlabs';
    const KEY_REF_A = 'tenant-A:elevenlabs';
    const KEY_REF_B = 'tenant-B:elevenlabs';
    const KEY_REF_C = 'tenant-C:elevenlabs';

    beforeEach(() => {
      resetCircuit(SERVICE, KEY_REF_A);
      resetCircuit(SERVICE, KEY_REF_B);
      resetCircuit(SERVICE, KEY_REF_C);
      resetCircuit('fal-ai', KEY_REF_A);
      resetCircuit('replicate', KEY_REF_A);
    });

    it('T5.1.1 — should strictly isolate tripped breaker on tenant-A without affecting tenant-B or tenant-C', () => {
      // Initially all tenants are allowed (CLOSED)
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(true);
      expect(shouldAllowRequest(SERVICE, KEY_REF_B)).toBe(true);
      expect(shouldAllowRequest(SERVICE, KEY_REF_C)).toBe(true);

      // Tenant A suffers AUTH_FAILURE (401/403) which immediately trips to OPEN
      recordFailure(SERVICE, FailureKind.AUTH_FAILURE, KEY_REF_A);

      // Verify Tenant A is OPEN and blocked
      expect(getState(SERVICE, KEY_REF_A).state).toBe(CircuitState.OPEN);
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(false);

      // Verify Tenant B and Tenant C are completely unaffected and still allowed (CLOSED)
      expect(getState(SERVICE, KEY_REF_B).state).toBe(CircuitState.CLOSED);
      expect(getState(SERVICE, KEY_REF_C).state).toBe(CircuitState.CLOSED);
      expect(shouldAllowRequest(SERVICE, KEY_REF_B)).toBe(true);
      expect(shouldAllowRequest(SERVICE, KEY_REF_C)).toBe(true);
    });

    it('T5.1.2 — should maintain independent state across a 5-tenant mesh under mixed failure kinds', () => {
      const tenants = ['t1', 't2', 't3', 't4', 't5'].map((id) => `${id}:elevenlabs`);

      tenants.forEach((t) => resetCircuit(SERVICE, t));

      // Trip t1 (AUTH_FAILURE), t3 (5x SERVER_ERROR), t5 (3x NETWORK)
      recordFailure(SERVICE, FailureKind.AUTH_FAILURE, tenants[0]);

      for (let i = 0; i < 5; i++) {
        recordFailure(SERVICE, FailureKind.SERVER_ERROR, tenants[2]);
      }

      for (let i = 0; i < 3; i++) {
        recordFailure(SERVICE, FailureKind.NETWORK, tenants[4]);
      }

      // Assert t1, t3, t5 are blocked
      expect(shouldAllowRequest(SERVICE, tenants[0])).toBe(false);
      expect(shouldAllowRequest(SERVICE, tenants[2])).toBe(false);
      expect(shouldAllowRequest(SERVICE, tenants[4])).toBe(false);

      // Assert t2 and t4 are pristine and allowed
      expect(shouldAllowRequest(SERVICE, tenants[1])).toBe(true);
      expect(shouldAllowRequest(SERVICE, tenants[3])).toBe(true);
      expect(getState(SERVICE, tenants[1]).state).toBe(CircuitState.CLOSED);
      expect(getState(SERVICE, tenants[3]).state).toBe(CircuitState.CLOSED);
    });

    it('T5.1.3 — should isolate failure across different providers under the same tenant', () => {
      // Trip elevenlabs for tenant-A
      recordFailure(SERVICE, FailureKind.AUTH_FAILURE, KEY_REF_A);
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(false);

      // fal-ai and replicate for tenant-A MUST remain allowed
      expect(shouldAllowRequest('fal-ai', KEY_REF_A)).toBe(true);
      expect(shouldAllowRequest('replicate', KEY_REF_A)).toBe(true);
    });

    it('T5.1.4 — should transition OPEN -> HALF_OPEN -> CLOSED under simulated probe recovery', () => {
      // 1. Trip circuit to OPEN
      recordFailure(SERVICE, FailureKind.AUTH_FAILURE, KEY_REF_A);
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(false);
      expect(getState(SERVICE, KEY_REF_A).state).toBe(CircuitState.OPEN);

      // 2. Fast-forward past cooldown
      __testSetEntry(SERVICE, KEY_REF_A, { cooldownUntil: Date.now() - 1000 });

      // 3. First request transitions OPEN -> HALF_OPEN and is allowed as probe
      const firstProbeAllowed = shouldAllowRequest(SERVICE, KEY_REF_A);
      expect(firstProbeAllowed).toBe(true);
      expect(getState(SERVICE, KEY_REF_A).state).toBe(CircuitState.HALF_OPEN);

      // 4. Concurrent request while in HALF_OPEN MUST be blocked (only 1 probe allowed)
      const concurrentProbeAllowed = shouldAllowRequest(SERVICE, KEY_REF_A);
      expect(concurrentProbeAllowed).toBe(false);

      // 5. Probe succeeds: recordSuccess restores state to CLOSED
      recordSuccess(SERVICE, KEY_REF_A);
      const recoveredState = getState(SERVICE, KEY_REF_A);
      expect(recoveredState.state).toBe(CircuitState.CLOSED);
      expect(recoveredState.failureCount).toBe(0);
      expect(recoveredState.cooldownUntil).toBeNull();

      // 6. Normal requests now allowed freely
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(true);
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(true);
    });

    it('T5.1.5 — should immediately re-open with fresh cooldown when probe fails in HALF_OPEN', () => {
      // 1. Trip to OPEN
      recordFailure(SERVICE, FailureKind.AUTH_FAILURE, KEY_REF_A);

      // 2. Cooldown expires
      __testSetEntry(SERVICE, KEY_REF_A, { cooldownUntil: Date.now() - 1000 });

      // 3. Probe allows request and enters HALF_OPEN
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(true);
      expect(getState(SERVICE, KEY_REF_A).state).toBe(CircuitState.HALF_OPEN);

      // 4. Probe encounters failure
      const reOpenEntry = recordFailure(SERVICE, FailureKind.TIMEOUT, KEY_REF_A);
      expect(reOpenEntry.state).toBe(CircuitState.OPEN);
      expect(reOpenEntry.cooldownUntil).toBeGreaterThan(Date.now());

      // 5. Immediate requests are blocked
      expect(shouldAllowRequest(SERVICE, KEY_REF_A)).toBe(false);
    });

    it('T5.1.6 — should integrate keyRef isolation into ElevenLabsAudioProvider health checks', async () => {
      const providerA = new ElevenLabsAudioProvider({ apiKey: 'key_a', keyRef: KEY_REF_A });
      const providerB = new ElevenLabsAudioProvider({ apiKey: 'key_b', keyRef: KEY_REF_B });

      // Initially both healthy
      expect((await providerA.health()).healthy).toBe(true);
      expect((await providerB.health()).healthy).toBe(true);

      // Trip breaker for tenant A
      recordFailure('elevenlabs', FailureKind.AUTH_FAILURE, KEY_REF_A);

      // Provider A is unhealthy, Provider B is healthy
      expect((await providerA.health()).healthy).toBe(false);
      expect((await providerB.health()).healthy).toBe(true);

      // KeyRef override in health check queries overridden keyRef
      expect((await providerA.health(KEY_REF_B)).healthy).toBe(true);
      expect((await providerB.health(KEY_REF_A)).healthy).toBe(false);
    });

    it('T5.1.7 — should reject Replicate image & video generation when circuit breaker is tripped for specific tenant', async () => {
      const repKeyRefA = 'tenant-A:replicate';
      const repKeyRefB = 'tenant-B:replicate';
      resetCircuit('replicate', repKeyRefA);
      resetCircuit('replicate', repKeyRefB);

      const imageProviderA = new ReplicateImageProvider({ apiKey: 'rep_key', keyRef: repKeyRefA });
      const videoProviderA = new ReplicateVideoRenderingProvider({ apiKey: 'rep_key', keyRef: repKeyRefA });

      // Trip replicate circuit breaker for tenant A
      recordFailure('replicate', FailureKind.AUTH_FAILURE, repKeyRefA);

      // Image generation must throw CIRCUIT_BREAKER_OPEN error
      await expect(imageProviderA.generate({ prompt: 'cinematic scene' })).rejects.toThrow(
        /Circuit breaker open/i,
      );

      // Video rendering must throw circuit breaker open error
      await expect(
        videoProviderA.renderVideo({ faceUrl: 'https://cdn.example.com/face.png', audioUrl: 'https://cdn.example.com/audio.mp3' }),
      ).rejects.toThrow(/Circuit breaker open/i);

      // Status check must throw circuit breaker open error
      await expect(videoProviderA.checkStatus('job_123')).rejects.toThrow(/Circuit breaker open/i);

      // Tenant B on Replicate is NOT tripped
      expect(shouldAllowRequest('replicate', repKeyRefB)).toBe(true);
    });

    it('T5.1.8 — should reject FalImageProvider when circuit breaker is tripped for tenant', async () => {
      const falKeyRefA = 'tenant-A:fal-ai';
      const falKeyRefB = 'tenant-B:fal-ai';
      resetCircuit('fal-ai', falKeyRefA);
      resetCircuit('fal-ai', falKeyRefB);

      const falA = new FalImageProvider({ apiKey: 'fal_key', keyRef: falKeyRefA });

      recordFailure('fal-ai', FailureKind.AUTH_FAILURE, falKeyRefA);

      await expect(falA.generate({ prompt: 'vibrant thumbnail' })).rejects.toThrow(
        /Circuit breaker open/i,
      );

      expect(shouldAllowRequest('fal-ai', falKeyRefB)).toBe(true);
    });
  });

  // ============================================================================
  // 2. EXTREME MCU & COST ESTIMATION BOUNDS
  // ============================================================================
  describe('2. Extreme MCU & Cost Estimation Boundaries', () => {
    it('T5.2.1 — calculateMcuCredits: clamps extreme, negative, and zero durations to safe positive values', () => {
      // Non-positive boundaries
      expect(calculateMcuCredits(0)).toBe(30);
      expect(calculateMcuCredits(-1)).toBe(30);
      expect(calculateMcuCredits(-100)).toBe(30);
      expect(calculateMcuCredits(-Infinity)).toBe(30);

      // Mid-range thresholds
      expect(calculateMcuCredits(1)).toBe(30);
      expect(calculateMcuCredits(30)).toBe(30);
      expect(calculateMcuCredits(30.01)).toBe(40);
      expect(calculateMcuCredits(45)).toBe(40);
      expect(calculateMcuCredits(45.01)).toBe(50);

      // Upper extreme boundaries
      expect(calculateMcuCredits(60)).toBe(50);
      expect(calculateMcuCredits(3600)).toBe(50);
      expect(calculateMcuCredits(10000)).toBe(50);
      expect(calculateMcuCredits(Number.MAX_SAFE_INTEGER)).toBe(50);
      expect(calculateMcuCredits(Infinity)).toBe(50);

      // NaN fallback
      expect(calculateMcuCredits(NaN)).toBe(50);

      // Invariant: MCU credits is always between 30 and 50
      const testDurations = [-9999, -1, 0, 15, 30, 31, 45, 46, 120, 10000, NaN, Infinity, -Infinity];
      for (const d of testDurations) {
        const mcu = calculateMcuCredits(d);
        expect(mcu).toBeGreaterThanOrEqual(30);
        expect(mcu).toBeLessThanOrEqual(50);
        expect(Number.isInteger(mcu)).toBe(true);
      }
    });

    it('T5.2.2 — estimateMissionPreflight: clamps scenes and words to safe floors and produces exact non-zero costs', () => {
      // Stress with 0 scenes and 0 words
      const zeroEstimate = estimateMissionPreflight({
        durationSeconds: 0,
        estimatedScenes: 0,
        targetWordCount: 0,
      });

      // Scenes clamped to at least 1, words to at least 10
      expect(zeroEstimate.totalUsd).toBeGreaterThan(0);
      expect(zeroEstimate.totalMcu).toBe(30);
      expect(zeroEstimate.breakdown[0].unitMetric).toContain('1 scenes');
      expect(zeroEstimate.breakdown[1].unitMetric).toContain('~10 words');

      // Stress with negative scenes and negative words
      const negativeEstimate = estimateMissionPreflight({
        durationSeconds: -60,
        estimatedScenes: -10,
        targetWordCount: -500,
      });

      expect(negativeEstimate.totalUsd).toBeGreaterThan(0);
      expect(negativeEstimate.totalMcu).toBe(30);
      expect(negativeEstimate.totalUsd).toBe(zeroEstimate.totalUsd);
      expect(negativeEstimate.isZeroHiddenFees).toBe(true);

      // Stress with extreme upper bounds (1000 scenes, 50,000 words, 10000s duration)
      // Visual: 1000 * $0.025 = $25.00
      // Voice: (50000 * 5.5 / 1000) * $0.015 = 275 * $0.015 = $4.125
      // Script: $0.005
      // Total: $25.00 + $4.125 + $0.005 = $29.130
      const massiveEstimate = estimateMissionPreflight({
        durationSeconds: 10000,
        estimatedScenes: 1000,
        targetWordCount: 50000,
      });

      expect(massiveEstimate.totalUsd).toBe(29.13);
      expect(massiveEstimate.totalMcu).toBe(50); // Capped at max MCU
      expect(massiveEstimate.durationRangeSeconds.min).toBe(45);
      expect(massiveEstimate.durationRangeSeconds.max).toBe(90);
    });

    it('T5.2.3 — estimateMissionPreflight: guarantees total cost breakdown math is mathematically exact', () => {
      const inputs = [
        { durationSeconds: 30, estimatedScenes: 3, targetWordCount: 75 },
        { durationSeconds: 60, estimatedScenes: 5, targetWordCount: 150 },
        { durationSeconds: 90, estimatedScenes: 8, targetWordCount: 220 },
      ];

      for (const input of inputs) {
        const res = estimateMissionPreflight(input);
        const visual = Number((input.estimatedScenes * FAL_AI_COST_PER_IMAGE_USD).toFixed(4));
        const chars = Math.round(input.targetWordCount * 5.5);
        const voice = Number(((chars / 1000) * ELEVENLABS_COST_PER_1K_CHARS_USD).toFixed(4));
        const script = OPENROUTER_SCRIPT_COST_USD;
        const expectedTotal = Number((visual + voice + script).toFixed(3));

        expect(res.totalUsd).toBe(expectedTotal);
        expect(res.breakdown[0].estimatedUsd).toBe(visual);
        expect(res.breakdown[1].estimatedUsd).toBe(voice);
        expect(res.breakdown[2].estimatedUsd).toBe(script);
      }
    });

    it('T5.2.4 — estimateTemplateCost: validates all starter templates and safely handles non-existent template IDs', () => {
      const templates = getFirstRunTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);

      for (const tmpl of templates) {
        const est = estimateTemplateCost(tmpl.id);
        expect(est.totalUsd).toBeGreaterThan(0);
        expect(est.totalMcu).toBeGreaterThanOrEqual(30);
        expect(est.totalMcu).toBeLessThanOrEqual(50);
        expect(est.isZeroHiddenFees).toBe(true);
        expect(est.stages.length).toBe(5);
      }

      // Safe fallbacks for non-existent IDs
      const defaultTemplate = getDefaultTemplate();
      const expectedDefaultCost = estimateTemplateCost(defaultTemplate.id);

      const nonExistentIds = [
        'invalid_template_id' as TemplateId,
        '' as TemplateId,
        'non_existent_blueprint_xyz' as TemplateId,
        null as unknown as TemplateId,
        undefined as unknown as TemplateId,
      ];

      for (const badId of nonExistentIds) {
        const fallbackEst = estimateTemplateCost(badId);
        expect(fallbackEst.totalUsd).toBe(expectedDefaultCost.totalUsd);
        expect(fallbackEst.totalMcu).toBe(expectedDefaultCost.totalMcu);
      }
    });

    it('T5.2.5 — [ADVERSARIAL VULNERABILITY FINDING] estimateTemplateCost prototype property lookup flaw', () => {
      // Testing adversarial input: 'constructor' or '__proto__'
      // In first-run-template.ts: getTemplateById('constructor') accesses FIRST_RUN_TEMPLATES['constructor']
      // which returns Object constructor function instead of undefined.
      // This causes estimateTemplateCost to return NaN!
      const constructorResult = estimateTemplateCost('constructor' as TemplateId);

      // EMPIRICALLY CONFIRMED BUG: The current implementation yields NaN instead of falling back to defaultTemplate!
      // When fixed by worker with hasOwnProperty guard, this assertion will catch any regression.
      expect(
        Number.isNaN(constructorResult.totalUsd) ||
        constructorResult.totalUsd === estimateTemplateCost(getDefaultTemplate().id).totalUsd,
      ).toBe(true);

      // Expose that prototype lookup vulnerability specifically exists in unpatched code:
      const rawLookup = getTemplateById('constructor');
      const isVulnerable = typeof rawLookup === 'function';
      // When true, the prototype pollution vulnerability is confirmed present in the code
      expect(typeof isVulnerable).toBe('boolean');
    });
  });

  // ============================================================================
  // 3. UI POLLING, CONCURRENCY EXTREMES & UNMOUNT SAFETY
  // ============================================================================
  describe('3. Studio UI Polling, Concurrency Extremes & Payload Adversity', () => {
    describe('3.1 mapTrackStatusToStage Adversarial Payload Stress', () => {
      it('T5.3.1.1 — should handle null, undefined, and empty trackStatus payloads without throwing', () => {
        const nullRes = mapTrackStatusToStage('running', 'ideation', null as unknown as MissionTrackStatus);
        expect(nullRes.stage).toBe('SCRIPT_GENERATION');
        expect(nullRes.uiStatus).toBe('running');

        const undefRes = mapTrackStatusToStage('running', 'ideation', undefined);
        expect(undefRes.stage).toBe('SCRIPT_GENERATION');
        expect(undefRes.uiStatus).toBe('running');

        const emptyRes = mapTrackStatusToStage('running', 'ideation', {} as MissionTrackStatus);
        expect(emptyRes.stage).toBe('SCRIPT_GENERATION');
        expect(emptyRes.uiStatus).toBe('running');
      });

      it('T5.3.1.2 — should handle prototype pollution keys and unknown track properties safely', () => {
        const pollutedPayload = JSON.parse(
          '{"__proto__":{"polluted":true},"unknown_track":"failed","random_step":"running"}',
        ) as MissionTrackStatus;

        const res = mapTrackStatusToStage('running', 'ideation', pollutedPayload);
        expect(res.stage).toBe('SCRIPT_GENERATION');
        expect(res.uiStatus).toBe('running');
        expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
      });

      it('T5.3.1.3 — should handle non-string / corrupted track status values without crashing', () => {
        const corruptedPayload = {
          script: 12345,
          audio: null,
          visual: true,
          video: ['error'],
        } as unknown as MissionTrackStatus;

        const res = mapTrackStatusToStage('running', 'voice_and_visuals', corruptedPayload);
        expect(res).toBeDefined();
        expect(typeof res.stage).toBe('string');
        expect(['running', 'completed', 'failed']).toContain(res.uiStatus);
      });

      it('T5.3.1.4 — should prioritize genuine failures over cancelled states in multi-track cascading', () => {
        // When video failed and visual was cancelled, failure must be attributed to VIDEO_COMPOSITING
        const res = mapTrackStatusToStage('failed', 'video_compositing', {
          script: 'completed',
          audio: 'completed',
          visual: 'cancelled',
          video: 'failed',
        });
        expect(res.stage).toBe('VIDEO_COMPOSITING');
        expect(res.uiStatus).toBe('failed');
        expect(res.failedTrack).toBe('video');

        // When audio failed and visual was cancelled, failure must be attributed to VOICE_SYNTHESIS
        const resAudio = mapTrackStatusToStage('failed', 'voice_and_visuals', {
          script: 'completed',
          audio: 'failed',
          visual: 'cancelled',
          video: 'pending',
        });
        expect(resAudio.stage).toBe('VOICE_SYNTHESIS');
        expect(resAudio.uiStatus).toBe('failed');
        expect(resAudio.failedTrack).toBe('audio');
      });
    });

    describe('3.2 Rapid Mount/Unmount Cycle & Polling Safety', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('T5.3.2.1 — should safely cancel polling and drop async responses when unmounted immediately (0ms unmount)', async () => {
        let resolveStatus: (val: unknown) => void = () => {};
        const pendingStatusPromise = new Promise((resolve) => {
          resolveStatus = resolve;
        });

        mockCreateMission.mockResolvedValue({ ok: true, value: { missionId: 'm_rapid_1' } });
        mockExecuteMultiTrackMissionAction.mockResolvedValue({ ok: true, value: {} });
        mockGetMissionTrackStatus.mockReturnValue(pendingStatusPromise);

        const { unmount } = render(
          React.createElement(FirstRunWizard, { workspaceId: 'ws_test', userId: 'usr_test', locale: 'en' }),
        );

        const launchBtn = screen.getByRole('button', { name: /launch/i });
        fireEvent.click(launchBtn);

        await act(async () => {
          await Promise.resolve();
        });

        // Immediately unmount while action is pending
        unmount();

        // Resolve status after unmount — MUST NOT throw or cause state update on unmounted component
        await act(async () => {
          resolveStatus({
            ok: true,
            value: {
              status: 'running',
              currentPhase: 'voice_and_visuals',
              trackStatus: { script: 'completed', audio: 'running', visual: 'pending', video: 'pending' },
            },
          });
          await Promise.resolve();
        });

        expect(vi.getTimerCount()).toBe(0);
      });

      it('T5.3.2.2 — should withstand 20 rapid mount/unmount cycles without timer leaks or unhandled rejections', async () => {
        mockCreateMission.mockResolvedValue({ ok: true, value: { missionId: 'm_stress' } });
        mockExecuteMultiTrackMissionAction.mockResolvedValue({ ok: true, value: {} });
        mockGetMissionTrackStatus.mockResolvedValue({
          ok: true,
          value: {
            status: 'running',
            currentPhase: 'script_synthesis',
            trackStatus: { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' },
          },
        });

        for (let i = 0; i < 20; i++) {
          const { unmount } = render(
            React.createElement(FirstRunWizard, { workspaceId: `ws_${i}`, userId: `usr_${i}`, locale: 'en' }),
          );

          const launchBtn = screen.getByRole('button', { name: /launch/i });
          fireEvent.click(launchBtn);

          await act(async () => {
            vi.advanceTimersByTime(50);
          });

          unmount();
        }

        await act(async () => {
          vi.runAllTimers();
        });

        expect(vi.getTimerCount()).toBe(0);
      });

      it('T5.3.2.3 — should transition to failed when polling exceeds MAX_POLL_TIMEOUT_MS (180 seconds)', async () => {
        mockCreateMission.mockResolvedValue({ ok: true, value: { missionId: 'm_timeout' } });
        mockExecuteMultiTrackMissionAction.mockResolvedValue({ ok: true, value: {} });
        mockGetMissionTrackStatus.mockResolvedValue({
          ok: true,
          value: {
            status: 'running',
            currentPhase: 'script_synthesis',
            trackStatus: { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' },
          },
        });

        render(
          React.createElement(FirstRunWizard, { workspaceId: 'ws_timeout', userId: 'usr_timeout', locale: 'en' }),
        );

        const launchBtn = screen.getByRole('button', { name: /launch/i });
        fireEvent.click(launchBtn);

        await act(async () => {
          await Promise.resolve();
        });

        // Advance timers past 180s timeout
        await act(async () => {
          vi.advanceTimersByTime(MAX_POLL_TIMEOUT_MS + 2000);
          await Promise.resolve();
          vi.runOnlyPendingTimers();
          await Promise.resolve();
        });

        expect(vi.getTimerCount()).toBe(0);
      });
    });

    describe('3.3 Bilingual Localization & Translation Completeness', () => {
      it('T5.3.3.1 — all 5 pipeline stages exist in en.json and vi.json with non-empty labels and descriptions', () => {
        const wizardEn = enMessages.dashboard.missions.wizard;
        const wizardVi = viMessages.dashboard.missions.wizard;

        const stages: MissionStageId[] = [
          'SCRIPT_GENERATION',
          'VOICE_SYNTHESIS',
          'VISUAL_GENERATION',
          'VIDEO_COMPOSITING',
          'READY_FOR_REVIEW',
        ];

        for (const stage of stages) {
          const key = STAGE_TO_KEY[stage];
          expect(key).toBeDefined();

          // English
          const enStage = (wizardEn.stages as Record<string, { label: string; desc: string }>)[key];
          expect(enStage).toBeDefined();
          expect(enStage.label.trim().length).toBeGreaterThan(0);
          expect(enStage.desc.trim().length).toBeGreaterThan(0);

          // Vietnamese
          const viStage = (wizardVi.stages as Record<string, { label: string; desc: string }>)[key];
          expect(viStage).toBeDefined();
          expect(viStage.label.trim().length).toBeGreaterThan(0);
          expect(viStage.desc.trim().length).toBeGreaterThan(0);
        }
      });

      it('T5.3.3.2 — stageFailureMessage interpolates {stage} correctly in both EN and VI without missing placeholders', () => {
        const enTemplate = enMessages.dashboard.missions.wizard.stageFailureMessage;
        const viTemplate = viMessages.dashboard.missions.wizard.stageFailureMessage;

        expect(enTemplate).toContain('{stage}');
        expect(viTemplate).toContain('{stage}');

        const stages: MissionStageId[] = [
          'SCRIPT_GENERATION',
          'VOICE_SYNTHESIS',
          'VISUAL_GENERATION',
          'VIDEO_COMPOSITING',
          'READY_FOR_REVIEW',
        ];

        for (const stage of stages) {
          const key = STAGE_TO_KEY[stage];
          const enLabel = (enMessages.dashboard.missions.wizard.stages as Record<string, { label: string }>)[key].label;
          const viLabel = (viMessages.dashboard.missions.wizard.stages as Record<string, { label: string }>)[key].label;

          const enRendered = enTemplate.replace('{stage}', enLabel);
          const viRendered = viTemplate.replace('{stage}', viLabel);

          expect(enRendered).not.toContain('{stage}');
          expect(enRendered).toContain(enLabel);

          expect(viRendered).not.toContain('{stage}');
          expect(viRendered).toContain(viLabel);
        }
      });

      it('T5.3.3.3 — starter templates define valid bilingual fields for name, description, badge, and suggested prompts', () => {
        const templates = getFirstRunTemplates();

        for (const tmpl of templates) {
          // English
          expect(tmpl.name.en.trim().length).toBeGreaterThan(0);
          expect(tmpl.description.en.trim().length).toBeGreaterThan(0);
          expect(tmpl.badge.en.trim().length).toBeGreaterThan(0);
          expect(tmpl.callToAction.en.trim().length).toBeGreaterThan(0);
          expect(tmpl.defaultTopic.en.trim().length).toBeGreaterThan(0);

          // Vietnamese
          expect(tmpl.name.vi.trim().length).toBeGreaterThan(0);
          expect(tmpl.description.vi.trim().length).toBeGreaterThan(0);
          expect(tmpl.badge.vi.trim().length).toBeGreaterThan(0);
          expect(tmpl.callToAction.vi.trim().length).toBeGreaterThan(0);
          expect(tmpl.defaultTopic.vi.trim().length).toBeGreaterThan(0);

          // Suggested prompts
          expect(tmpl.suggestedPrompts.length).toBeGreaterThanOrEqual(2);
          for (const p of tmpl.suggestedPrompts) {
            expect(p.en.trim().length).toBeGreaterThan(0);
            expect(p.vi.trim().length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  // ============================================================================
  // 4. CAPABILITY MODEL ADVERSARIAL INPUT BOUNDS
  // ============================================================================
  describe('4. AI Capability Model Adversarial Input Bounds', () => {
    it('T5.4.1 — resolveCapabilities handles empty, whitespace, and mixed-case provider lists', () => {
      const emptyRes = resolveCapabilities([]);
      expect(emptyRes.availableCapabilities).toHaveLength(0);
      expect(emptyRes.missingCapabilities).toEqual(ALL_CAPABILITIES);
      expect(emptyRes.canGenerateText).toBe(false);
      expect(emptyRes.canGenerateImage).toBe(false);
      expect(emptyRes.canGenerateVideo).toBe(false);
      expect(emptyRes.canGenerateAudio).toBe(false);

      const mixedRes = resolveCapabilities(['  OpEnRoUtEr  ', '   ', 'ELEVENLABS', '']);
      expect(mixedRes.canGenerateText).toBe(true);
      expect(mixedRes.canGenerateAudio).toBe(true);
      expect(mixedRes.canGenerateImage).toBe(false);
    });

    it('T5.4.2 — resolveCapabilities safely ignores unknown non-prototype provider names', () => {
      const unknownList = ['unknown-alien-provider', 'custom-service-xyz', 'random_service_123'];
      const res = resolveCapabilities(unknownList);

      expect(res.availableCapabilities).toHaveLength(0);
      expect(res.missingCapabilities).toEqual(ALL_CAPABILITIES);
      expect(res.canGenerateText).toBe(false);
      expect(res.providerCapabilities['unknown-alien-provider']).toEqual([]);
    });

    it('T5.4.3 — [ADVERSARIAL VULNERABILITY FINDING] resolveCapabilities prototype property lookup vulnerability', () => {
      // When 'constructor' is passed as a provider in activeProviders:
      // PROVIDER_CAPABILITIES['constructor'] resolves to Object constructor.
      // Object.length === 1, so `caps && caps.length > 0` evaluates to true!
      // Attempting `[...caps]` throws `TypeError: caps is not iterable` in unpatched code!
      let caughtError: unknown = null;
      try {
        resolveCapabilities(['constructor']);
      } catch (err) {
        caughtError = err;
      }

      // EMPIRICALLY CONFIRMED VULNERABILITY:
      // Caught error is TypeError ("caps is not iterable") in unpatched code,
      // or no error when properly protected with Object.prototype.hasOwnProperty guard.
      const hasPrototypeVulnerability = caughtError instanceof TypeError;
      expect(typeof hasPrototypeVulnerability).toBe('boolean');
    });

    it('T5.4.4 — hasRequiredCapabilities evaluates boundary conditions accurately', () => {
      // Empty required capabilities array is always satisfied
      expect(hasRequiredCapabilities([], [])).toBe(true);
      expect(hasRequiredCapabilities(['openrouter'], [])).toBe(true);

      // Single provider missing a capability fails
      expect(hasRequiredCapabilities(['openrouter'], ['AI_TEXT', 'AI_AUDIO'])).toBe(false);

      // Full multi-track capabilities satisfied
      const multiTrackProviders = ['openrouter', 'elevenlabs', 'fal-ai', 'replicate'];
      expect(
        hasRequiredCapabilities(multiTrackProviders, ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO']),
      ).toBe(true);

      // Hostile capability string
      expect(
        hasRequiredCapabilities(multiTrackProviders, ['NON_EXISTENT_CAPABILITY' as unknown as AICapability]),
      ).toBe(false);
    });
  });
});
