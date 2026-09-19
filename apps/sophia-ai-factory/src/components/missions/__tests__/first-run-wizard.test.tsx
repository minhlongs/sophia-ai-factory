/**
 * Unit tests for FirstRunWizard component and mapTrackStatusToStage helper.
 * Tests stage mapping, parameter forwarding, real action triggering, and polling lifecycle.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

import {
  FirstRunWizard,
  mapTrackStatusToStage,
} from '../first-run-wizard';

describe('FirstRunWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mapTrackStatusToStage', () => {
    it('maps review and completed statuses to READY_FOR_REVIEW', () => {
      expect(mapTrackStatusToStage('review', 'review')).toEqual({
        stage: 'READY_FOR_REVIEW',
        uiStatus: 'completed',
      });
      expect(mapTrackStatusToStage('completed', 'completed')).toEqual({
        stage: 'READY_FOR_REVIEW',
        uiStatus: 'completed',
      });
    });

    it('maps sub-track failures accurately to their respective stages', () => {
      expect(
        mapTrackStatusToStage('failed', 'video_compositing', {
          script: 'completed',
          audio: 'completed',
          visual: 'completed',
          video: 'failed',
        })
      ).toEqual({
        stage: 'VIDEO_COMPOSITING',
        uiStatus: 'failed',
        failedTrack: 'video',
      });

      expect(
        mapTrackStatusToStage('failed', 'voice_and_visuals', {
          script: 'completed',
          audio: 'completed',
          visual: 'failed',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VISUAL_GENERATION',
        uiStatus: 'failed',
        failedTrack: 'visual',
      });

      expect(
        mapTrackStatusToStage('failed', 'voice_and_visuals', {
          script: 'completed',
          audio: 'failed',
          visual: 'cancelled',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VOICE_SYNTHESIS',
        uiStatus: 'failed',
        failedTrack: 'audio',
      });

      expect(
        mapTrackStatusToStage('failed', 'script_generation', {
          script: 'failed',
          audio: 'pending',
          visual: 'pending',
          video: 'pending',
        })
      ).toEqual({
        stage: 'SCRIPT_GENERATION',
        uiStatus: 'failed',
        failedTrack: 'script',
      });
    });

    it('maps running tracks to the corresponding progress stage', () => {
      // Script running
      expect(
        mapTrackStatusToStage('running', 'script_generation', {
          script: 'running',
          audio: 'pending',
          visual: 'pending',
          video: 'pending',
        })
      ).toEqual({
        stage: 'SCRIPT_GENERATION',
        uiStatus: 'running',
      });

      // Script done, audio/visual starting
      expect(
        mapTrackStatusToStage('running', 'voice_and_visuals', {
          script: 'completed',
          audio: 'running',
          visual: 'running',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VOICE_SYNTHESIS',
        uiStatus: 'running',
      });

      // Audio done, visuals still running
      expect(
        mapTrackStatusToStage('running', 'voice_and_visuals', {
          script: 'completed',
          audio: 'completed',
          visual: 'running',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VISUAL_GENERATION',
        uiStatus: 'running',
      });

      // Audio & visual done, video compositing running
      expect(
        mapTrackStatusToStage('running', 'video_compositing', {
          script: 'completed',
          audio: 'completed',
          visual: 'completed',
          video: 'running',
        })
      ).toEqual({
        stage: 'VIDEO_COMPOSITING',
        uiStatus: 'running',
      });
    });

    it('returns uiStatus: "failed" when top-level status is "running" but a sub-track failed', () => {
      // Audio sub-track failed while top-level status is still 'running'
      expect(
        mapTrackStatusToStage('running', 'voice_and_visuals', {
          script: 'completed',
          audio: 'failed',
          visual: 'cancelled',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VOICE_SYNTHESIS',
        uiStatus: 'failed',
        failedTrack: 'audio',
      });

      // Visual sub-track failed while top-level status is still 'running'
      expect(
        mapTrackStatusToStage('running', 'voice_and_visuals', {
          script: 'completed',
          audio: 'cancelled',
          visual: 'failed',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VISUAL_GENERATION',
        uiStatus: 'failed',
        failedTrack: 'visual',
      });

      // Video sub-track failed while top-level status is still 'running'
      expect(
        mapTrackStatusToStage('running', 'video_compositing', {
          script: 'completed',
          audio: 'completed',
          visual: 'completed',
          video: 'failed',
        })
      ).toEqual({
        stage: 'VIDEO_COMPOSITING',
        uiStatus: 'failed',
        failedTrack: 'video',
      });
    });

    it('correctly attributes stage when top-level status is "cancelled" and tracks are cancelled', () => {
      // Cancelled during visual generation
      expect(
        mapTrackStatusToStage('cancelled', 'voice_and_visuals', {
          script: 'completed',
          audio: 'completed',
          visual: 'cancelled',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VISUAL_GENERATION',
        uiStatus: 'failed',
        failedTrack: 'visual',
      });

      // Cancelled during voice synthesis
      expect(
        mapTrackStatusToStage('cancelled', 'voice_and_visuals', {
          script: 'completed',
          audio: 'cancelled',
          visual: 'pending',
          video: 'pending',
        })
      ).toEqual({
        stage: 'VOICE_SYNTHESIS',
        uiStatus: 'failed',
        failedTrack: 'audio',
      });

      // Cancelled during video compositing
      expect(
        mapTrackStatusToStage('cancelled', 'video_compositing', {
          script: 'completed',
          audio: 'completed',
          visual: 'completed',
          video: 'cancelled',
        })
      ).toEqual({
        stage: 'VIDEO_COMPOSITING',
        uiStatus: 'failed',
        failedTrack: 'video',
      });
    });
  });

  describe('Component Rendering & Parameter Forwarding', () => {
    it('renders initial form with 3 templates and default topic', () => {
      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      expect(screen.getByText('templateSelectLabel')).toBeTruthy();
      expect(screen.getByText('guide.q1_label')).toBeTruthy();
      expect(screen.getByText('guide.q4_label')).toBeTruthy();
      expect(screen.getByRole('button', { name: /launchButton/i })).toBeTruthy();
    });

    it('switches templates and updates topic and cost transparently', () => {
      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      // Find Affiliate Product Showcase template button
      const affiliateTmplBtn = screen.getByText(/Giới thiệu sản phẩm Tiếp thị liên kết/i);
      fireEvent.click(affiliateTmplBtn);

      // Verify the topic input updated to the template's default topic
      const topicInput = screen.getByDisplayValue(/Thiết bị công thái học giúp cải thiện tư thế sau 7 ngày/i);
      expect(topicInput).toBeTruthy();
    });

    it('clicking suggested prompt pill updates input value', () => {
      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      // Viral shorts explainer prompt
      const pill = screen.getByText(/\+ 3 Thói quen buổi sáng/i);
      fireEvent.click(pill);

      expect(screen.getByDisplayValue('3 Thói quen buổi sáng của các nhà sáng lập hàng đầu')).toBeTruthy();
    });

    it('forwards complete blueprint constraints to createMission on launch', async () => {
      createMissionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_blueprint_123' },
      });

      executeMultiTrackMissionActionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_blueprint_123', status: 'completed' },
      });

      getMissionTrackStatusMock.mockResolvedValue({
        ok: true,
        value: {
          missionId: 'msn_blueprint_123',
          status: 'completed',
          currentPhase: 'review',
          trackStatus: { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' },
        },
      });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await waitFor(() => {
        expect(createMissionMock).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: 'ws_123',
            constraints: expect.objectContaining({
              templateId: 'viral_shorts_explainer',
              durationSeconds: 60,
              estimatedScenes: 5,
              aspectRatio: '9:16',
              voiceStyle: 'dynamic_hook',
              visualStyle: 'cinematic_vibrant',
              targetWordCount: 140,
              targetPlatform: 'youtube_shorts',
            }),
          })
        );
      });

      await waitFor(() => {
        expect(executeMultiTrackMissionActionMock).toHaveBeenCalledWith(
          expect.objectContaining({
            missionId: 'msn_blueprint_123',
            durationSeconds: 60,
            estimatedScenes: 5,
            aspectRatio: '9:16',
          })
        );
      });
    });

    it('handles createMission error gracefully', async () => {
      createMissionMock.mockResolvedValue({
        ok: false,
        error: { code: 'PREFLIGHT_FAILED', message: 'Insufficient MCU credits' },
      });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await waitFor(() => {
        expect(screen.getByText('Insufficient MCU credits')).toBeTruthy();
      });
    });

    it('renders completion screen with link to mission detail when completed', async () => {
      createMissionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_done_999' },
      });

      executeMultiTrackMissionActionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_done_999', status: 'completed' },
      });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await waitFor(() => {
        expect(screen.getByText('successTitle')).toBeTruthy();
      });

      const reviewLink = screen.getByRole('link', { name: /reviewButton/i });
      expect(reviewLink.getAttribute('href')).toBe('/dashboard/missions/msn_done_999');
    });

    it('enforces maxLength={200} on topic input boundary', () => {
      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);
      const topicInput = screen.getByRole('textbox') as HTMLInputElement;
      expect(topicInput.maxLength).toBe(200);
    });

    it('displays localized stageFailureMessage when sub-track fails during polling', async () => {
      createMissionMock.mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_fail_subtrack' },
      });

      executeMultiTrackMissionActionMock.mockReturnValue(new Promise(() => {}));

      getMissionTrackStatusMock.mockResolvedValue({
        ok: true,
        value: {
          missionId: 'msn_fail_subtrack',
          status: 'running',
          currentPhase: 'voice_and_visuals',
          trackStatus: { script: 'completed', audio: 'failed', visual: 'cancelled', video: 'pending' },
        },
      });

      render(<FirstRunWizard workspaceId="ws_123" userId="user_123" locale="vi" />);

      const launchBtn = screen.getByRole('button', { name: /launchButton/i });
      fireEvent.click(launchBtn);

      await waitFor(() => {
        expect(screen.getByText(/stageFailureMessage/i)).toBeTruthy();
      });
    });
  });
});
