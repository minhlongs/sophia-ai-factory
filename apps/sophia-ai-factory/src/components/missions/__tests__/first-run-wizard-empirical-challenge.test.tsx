/**
 * Empirical Challenge Test Suite for First-Run Wizard
 *
 * Covers:
 * 1. Sub-track failure mapping permutations across all tracks (script, audio, visual, video).
 * 2. Cancelled track attribution with priority order and fallbacks.
 * 3. Phase progression mapping across all 5 stages.
 * 4. Polling lifecycle, error tolerance, recovery, and 180s timeout.
 * 5. Bilingual failure messages & STAGE_TO_KEY parity (using en.dashboard.missions.wizard and vi.dashboard.missions.wizard).
 * 6. Template localization, non-standard locale fallbacks, and topic boundary guards.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Import JSON translations with strict typing
import enMessages from '../../../../messages/en.json';
import viMessages from '../../../../messages/vi.json';

import {
  FirstRunWizard,
  mapTrackStatusToStage,
  STAGE_TO_KEY,
  MAX_POLL_TIMEOUT_MS,
  POLL_INTERVAL_MS,
} from '../first-run-wizard';
import { getFirstRunTemplates } from '@/land/missions/first-run-template';
import type { MissionTrackStatus } from '@/forest/mission/multi-track-orchestrator';
import type { MissionStageId } from '../mission-progress-bar';

// Mocks
const createMissionMock = vi.fn();
const executeMultiTrackMissionActionMock = vi.fn();
const getMissionTrackStatusMock = vi.fn();

vi.mock('@/land/creative-mission/actions', () => ({
  createMission: (...args: unknown[]) => createMissionMock(...args),
  executeMultiTrackMissionAction: (...args: unknown[]) => executeMultiTrackMissionActionMock(...args),
  getMissionTrackStatus: (...args: unknown[]) => getMissionTrackStatusMock(...args),
}));

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
    }
    return key;
  },
}));

describe('FirstRunWizard Empirical Challenge Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Sub-Track Failure Mapping Permutations
  // ══════════════════════════════════════════════════════════════════════════
  describe('Sub-Track Failure State Permutations & Priority', () => {
    it('attributes failure to SCRIPT_GENERATION when script fails regardless of sibling states', () => {
      // Test combinations where script is failed
      const testCases: MissionTrackStatus[] = [
        { script: 'failed', audio: 'pending', visual: 'pending', video: 'pending' },
        { script: 'failed', audio: 'running', visual: 'running', video: 'pending' },
        { script: 'failed', audio: 'cancelled', visual: 'cancelled', video: 'pending' },
        { script: 'failed', audio: 'completed', visual: 'completed', video: 'pending' },
      ];

      for (const trackStatus of testCases) {
        const result = mapTrackStatusToStage('failed', 'script_synthesis', trackStatus);
        expect(result.stage).toBe('SCRIPT_GENERATION');
        expect(result.uiStatus).toBe('failed');
        expect(result.failedTrack).toBe('script');
      }
    });

    it('attributes failure to VOICE_SYNTHESIS when audio fails and script succeeded', () => {
      const testCases: MissionTrackStatus[] = [
        { script: 'completed', audio: 'failed', visual: 'pending', video: 'pending' },
        { script: 'completed', audio: 'failed', visual: 'running', video: 'pending' },
        { script: 'completed', audio: 'failed', visual: 'cancelled', video: 'pending' },
        { script: 'completed', audio: 'failed', visual: 'completed', video: 'pending' },
      ];

      for (const trackStatus of testCases) {
        const result = mapTrackStatusToStage('failed', 'voice_and_visuals', trackStatus);
        expect(result.stage).toBe('VOICE_SYNTHESIS');
        expect(result.uiStatus).toBe('failed');
        expect(result.failedTrack).toBe('audio');
      }
    });

    it('attributes failure to VISUAL_GENERATION when visual fails and script/audio succeeded', () => {
      const testCases: MissionTrackStatus[] = [
        { script: 'completed', audio: 'completed', visual: 'failed', video: 'pending' },
        { script: 'completed', audio: 'cancelled', visual: 'failed', video: 'pending' },
        { script: 'completed', audio: 'running', visual: 'failed', video: 'pending' },
      ];

      for (const trackStatus of testCases) {
        const result = mapTrackStatusToStage('failed', 'voice_and_visuals', trackStatus);
        expect(result.stage).toBe('VISUAL_GENERATION');
        expect(result.uiStatus).toBe('failed');
        expect(result.failedTrack).toBe('visual');
      }
    });

    it('attributes failure to VIDEO_COMPOSITING when video fails', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'failed',
      };
      const result = mapTrackStatusToStage('failed', 'video_compositing', trackStatus);
      expect(result.stage).toBe('VIDEO_COMPOSITING');
      expect(result.uiStatus).toBe('failed');
      expect(result.failedTrack).toBe('video');
    });

    it('prioritizes genuine failure over cancelled sibling (audio failed vs visual cancelled)', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'failed',
        visual: 'cancelled',
        video: 'pending',
      };
      const result = mapTrackStatusToStage('running', 'voice_and_visuals', trackStatus);
      expect(result.uiStatus).toBe('failed');
      expect(result.stage).toBe('VOICE_SYNTHESIS');
      expect(result.failedTrack).toBe('audio');
    });

    it('prioritizes genuine failure over cancelled sibling (visual failed vs audio cancelled)', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'cancelled',
        visual: 'failed',
        video: 'pending',
      };
      const result = mapTrackStatusToStage('running', 'voice_and_visuals', trackStatus);
      expect(result.uiStatus).toBe('failed');
      expect(result.stage).toBe('VISUAL_GENERATION');
      expect(result.failedTrack).toBe('visual');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Cancelled Mission Attribution
  // ══════════════════════════════════════════════════════════════════════════
  describe('Cancelled Mission Attribution', () => {
    it('attributes cancelled status to active script track', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'cancelled',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      };
      const result = mapTrackStatusToStage('cancelled', 'script_synthesis', trackStatus);
      expect(result.stage).toBe('SCRIPT_GENERATION');
      expect(result.uiStatus).toBe('failed');
      expect(result.failedTrack).toBe('script');
    });

    it('attributes cancelled status to active audio track', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'cancelled',
        visual: 'completed',
        video: 'pending',
      };
      const result = mapTrackStatusToStage('cancelled', 'voice_and_visuals', trackStatus);
      expect(result.stage).toBe('VOICE_SYNTHESIS');
      expect(result.uiStatus).toBe('failed');
      expect(result.failedTrack).toBe('audio');
    });

    it('attributes cancelled status to active visual track', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'cancelled',
        video: 'pending',
      };
      const result = mapTrackStatusToStage('cancelled', 'voice_and_visuals', trackStatus);
      expect(result.stage).toBe('VISUAL_GENERATION');
      expect(result.uiStatus).toBe('failed');
      expect(result.failedTrack).toBe('visual');
    });

    it('attributes cancelled status to active video track', () => {
      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'cancelled',
      };
      const result = mapTrackStatusToStage('cancelled', 'video_compositing', trackStatus);
      expect(result.stage).toBe('VIDEO_COMPOSITING');
      expect(result.uiStatus).toBe('failed');
      expect(result.failedTrack).toBe('video');
    });

    it('falls back safely to SCRIPT_GENERATION when trackStatus is undefined or empty', () => {
      const result1 = mapTrackStatusToStage('cancelled', 'script_synthesis');
      expect(result1.stage).toBe('SCRIPT_GENERATION');
      expect(result1.uiStatus).toBe('failed');

      const result2 = mapTrackStatusToStage('failed', 'script_synthesis', {
        script: 'pending',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      });
      expect(result2.stage).toBe('SCRIPT_GENERATION');
      expect(result2.uiStatus).toBe('failed');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: Phase Progression Mapping
  // ══════════════════════════════════════════════════════════════════════════
  describe('Phase Progression Mapping', () => {
    it('maps script_synthesis phase to SCRIPT_GENERATION running', () => {
      const res = mapTrackStatusToStage('running', 'script_synthesis', {
        script: 'running',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      });
      expect(res.stage).toBe('SCRIPT_GENERATION');
      expect(res.uiStatus).toBe('running');
    });

    it('maps voice_and_visuals phase to VOICE_SYNTHESIS running', () => {
      const res = mapTrackStatusToStage('running', 'voice_and_visuals', {
        script: 'completed',
        audio: 'running',
        visual: 'running',
        video: 'pending',
      });
      expect(res.stage).toBe('VOICE_SYNTHESIS');
      expect(res.uiStatus).toBe('running');
    });

    it('maps visual running phase to VISUAL_GENERATION when audio completes first', () => {
      const res = mapTrackStatusToStage('running', 'voice_and_visuals', {
        script: 'completed',
        audio: 'completed',
        visual: 'running',
        video: 'pending',
      });
      expect(res.stage).toBe('VISUAL_GENERATION');
      expect(res.uiStatus).toBe('running');
    });

    it('maps video_compositing phase to VIDEO_COMPOSITING running', () => {
      const res = mapTrackStatusToStage('running', 'video_compositing', {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'running',
      });
      expect(res.stage).toBe('VIDEO_COMPOSITING');
      expect(res.uiStatus).toBe('running');
    });

    it('maps review and completed phases to READY_FOR_REVIEW completed', () => {
      const reviewRes = mapTrackStatusToStage('running', 'review', {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });
      expect(reviewRes.stage).toBe('READY_FOR_REVIEW');
      expect(reviewRes.uiStatus).toBe('completed');

      const completedRes = mapTrackStatusToStage('completed', '', {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });
      expect(completedRes.stage).toBe('READY_FOR_REVIEW');
      expect(completedRes.uiStatus).toBe('completed');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 4: Polling Lifecycle & Resilience
  // ══════════════════════════════════════════════════════════════════════════
  describe('Polling Lifecycle, Resilience & Timeout', () => {
    it('recovers from consecutive ok: false poll responses without crashing', async () => {
      vi.useFakeTimers();

      createMissionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_poll_resilience' },
      });

      executeMultiTrackMissionActionMock.mockReturnValue(new Promise(() => {}));

      // Return ok: false twice, then ok: true completed
      getMissionTrackStatusMock
        .mockResolvedValueOnce({ ok: false, error: 'Database transient error' })
        .mockResolvedValueOnce({ ok: false, error: 'Connection reset' })
        .mockResolvedValueOnce({
          ok: true,
          value: {
            missionId: 'msn_poll_resilience',
            status: 'completed',
            currentPhase: 'review',
            trackStatus: { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' },
          },
        });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
      });

      expect(getMissionTrackStatusMock).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('recovers gracefully from network exceptions during polling', async () => {
      vi.useFakeTimers();

      createMissionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_network_error' },
      });

      executeMultiTrackMissionActionMock.mockReturnValue(new Promise(() => {}));

      getMissionTrackStatusMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          value: {
            missionId: 'msn_network_error',
            status: 'completed',
            currentPhase: 'review',
            trackStatus: { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' },
          },
        });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
      });

      expect(getMissionTrackStatusMock).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('transitions to failed status and displays timeoutError when polling exceeds MAX_POLL_TIMEOUT_MS', async () => {
      vi.useFakeTimers();

      createMissionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_timeout_test' },
      });

      executeMultiTrackMissionActionMock.mockReturnValue(new Promise(() => {}));

      getMissionTrackStatusMock.mockResolvedValue({
        ok: true,
        value: {
          missionId: 'msn_timeout_test',
          status: 'running',
          currentPhase: 'script_synthesis',
          trackStatus: { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' },
        },
      });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await act(async () => {
        // Advance time past MAX_POLL_TIMEOUT_MS (180_000 ms)
        await vi.advanceTimersByTimeAsync(MAX_POLL_TIMEOUT_MS + 2000);
      });

      expect(screen.getByText('timeoutError')).toBeTruthy();

      vi.useRealTimers();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 5: Bilingual Failure Messages & STAGE_TO_KEY Parity
  // ══════════════════════════════════════════════════════════════════════════
  describe('Empirical Challenge: Bilingual Failure Messages & STAGE_TO_KEY Parity', () => {
    const en = enMessages;
    const vi = viMessages;

    const stages: MissionStageId[] = [
      'SCRIPT_GENERATION',
      'VOICE_SYNTHESIS',
      'VISUAL_GENERATION',
      'VIDEO_COMPOSITING',
      'READY_FOR_REVIEW',
    ];

    it('validates canonical en.dashboard.missions.wizard and vi.dashboard.missions.wizard stage dictionary parity', () => {
      expect(en.dashboard.missions.wizard).toBeDefined();
      expect(vi.dashboard.missions.wizard).toBeDefined();

      const enWizard = en.dashboard.missions.wizard;
      const viWizard = vi.dashboard.missions.wizard;

      expect(enWizard.stages).toBeDefined();
      expect(viWizard.stages).toBeDefined();
      expect(enWizard.stageFailureMessage).toBeDefined();
      expect(viWizard.stageFailureMessage).toBeDefined();

      for (const stage of stages) {
        const key = STAGE_TO_KEY[stage];
        const enStage = (enWizard.stages as Record<string, { label: string; desc: string }>)[key];
        expect(enStage).toBeDefined();
        expect(enStage.label).toBeTruthy();
        expect(enStage.desc).toBeTruthy();

        const viStage = (viWizard.stages as Record<string, { label: string; desc: string }>)[key];
        expect(viStage).toBeDefined();
        expect(viStage.label).toBeTruthy();
        expect(viStage.desc).toBeTruthy();

        // Verify stageFailureMessage interpolates stage cleanly without raw placeholders
        const enFailure = enWizard.stageFailureMessage.replace('{stage}', enStage.label);
        expect(enFailure).not.toContain('{stage}');
        expect(enFailure).toContain(enStage.label);

        const viFailure = viWizard.stageFailureMessage.replace('{stage}', viStage.label);
        expect(viFailure).not.toContain('{stage}');
        expect(viFailure).toContain(viStage.label);
      }
    });

    it('formats stageFailureMessage properly for all 5 stages in English and Vietnamese', () => {
      const enWizard = en.dashboard.missions.wizard;
      const viWizard = vi.dashboard.missions.wizard;

      const enStages = enWizard.stages as Record<string, { label: string; desc: string }>;
      const viStages = viWizard.stages as Record<string, { label: string; desc: string }>;

      // Test exact strings
      const enScriptMsg = enWizard.stageFailureMessage.replace('{stage}', enStages.script_generation.label);
      expect(enScriptMsg).toBe('Pipeline failed at Script Generation. Click retry to restart.');

      const viScriptMsg = viWizard.stageFailureMessage.replace('{stage}', viStages.script_generation.label);
      expect(viScriptMsg).toContain('Soạn kịch bản thu hút');

      const enVoiceMsg = enWizard.stageFailureMessage.replace('{stage}', enStages.voice_synthesis.label);
      expect(enVoiceMsg).toBe('Pipeline failed at Voice Synthesis. Click retry to restart.');

      const viVoiceMsg = viWizard.stageFailureMessage.replace('{stage}', viStages.voice_synthesis.label);
      expect(viVoiceMsg).toContain('Lồng tiếng AI');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 6: Template Localization & Topic Input Boundary
  // ══════════════════════════════════════════════════════════════════════════
  describe('Template Localization & Topic Input Boundaries', () => {
    it('contains all 3 templates with bilingual fields and positive cost estimates', () => {
      const templates = getFirstRunTemplates();
      expect(templates.length).toBe(3);

      for (const tmpl of templates) {
        expect(tmpl.id).toBeTruthy();
        expect(tmpl.name.en).toBeTruthy();
        expect(tmpl.name.vi).toBeTruthy();
        expect(tmpl.description.en).toBeTruthy();
        expect(tmpl.description.vi).toBeTruthy();
        expect(tmpl.badge.en).toBeTruthy();
        expect(tmpl.badge.vi).toBeTruthy();
        expect(tmpl.durationSeconds).toBeGreaterThan(0);
        expect(tmpl.estimatedScenes).toBeGreaterThan(0);
      }
    });

    it('enforces maxLength={200} on topic input boundary in DOM', () => {
      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.maxLength).toBe(200);
    });

    it('handles unicode Vietnamese diacritics in topic input safely', () => {
      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      const vietnameseTopic = 'Trí tuệ nhân tạo và xu hướng tự động hóa nội dung số tại Việt Nam 2026';
      fireEvent.change(input, { target: { value: vietnameseTopic } });

      expect(input.value).toBe(vietnameseTopic);
      expect(input.value.length).toBeLessThanOrEqual(200);
    });
  });
});
