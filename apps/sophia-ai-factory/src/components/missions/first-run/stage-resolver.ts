/**
 * First-Run Wizard Track Status & Stage Resolvers
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/stage-resolver
 */

import type { MissionTrackStatus } from '@/tree/mission';
import type { MissionStageId } from '../mission-progress-bar';

export function resolveFailedStage(trackStatus?: MissionTrackStatus): {
  stage: MissionStageId;
  uiStatus: 'failed';
  failedTrack?: string;
} {
  // Check genuine failures first (root cause)
  if (trackStatus?.video === 'failed')
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'failed', failedTrack: 'video' };
  if (trackStatus?.visual === 'failed')
    return { stage: 'VISUAL_GENERATION', uiStatus: 'failed', failedTrack: 'visual' };
  if (trackStatus?.audio === 'failed')
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'failed', failedTrack: 'audio' };
  if (trackStatus?.script === 'failed')
    return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed', failedTrack: 'script' };

  // If mission was cancelled, attribute to the active cancelled track
  if (trackStatus?.video === 'cancelled')
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'failed', failedTrack: 'video' };
  if (trackStatus?.visual === 'cancelled')
    return { stage: 'VISUAL_GENERATION', uiStatus: 'failed', failedTrack: 'visual' };
  if (trackStatus?.audio === 'cancelled')
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'failed', failedTrack: 'audio' };
  if (trackStatus?.script === 'cancelled')
    return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed', failedTrack: 'script' };

  return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed' };
}

export function resolveRunningStage(
  currentPhase: string,
  trackStatus?: MissionTrackStatus,
): { stage: MissionStageId; uiStatus: 'running' | 'completed' } {
  if (trackStatus?.video === 'completed') {
    return { stage: 'READY_FOR_REVIEW', uiStatus: 'completed' };
  }
  const isVideoCompositing =
    trackStatus?.video === 'running' ||
    currentPhase === 'video_compositing' ||
    currentPhase === 'composited' ||
    (trackStatus?.audio === 'completed' && trackStatus?.visual === 'completed');
  if (isVideoCompositing) {
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'running' };
  }
  if (trackStatus?.audio === 'completed' && trackStatus?.visual === 'running') {
    return { stage: 'VISUAL_GENERATION', uiStatus: 'running' };
  }
  const isVoiceSynthesis =
    trackStatus?.script === 'completed' ||
    currentPhase === 'voice_and_visuals';
  if (isVoiceSynthesis) {
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'running' };
  }

  return { stage: 'SCRIPT_GENERATION', uiStatus: 'running' };
}

export function mapTrackStatusToStage(
  status: string,
  currentPhase: string,
  trackStatus?: MissionTrackStatus,
): { stage: MissionStageId; uiStatus: 'running' | 'completed' | 'failed'; failedTrack?: string } {
  if (status === 'review' || status === 'completed' || currentPhase === 'review') {
    return { stage: 'READY_FOR_REVIEW', uiStatus: 'completed' };
  }

  const hasFailedTrack =
    trackStatus?.video === 'failed' ||
    trackStatus?.visual === 'failed' ||
    trackStatus?.audio === 'failed' ||
    trackStatus?.script === 'failed';

  if (status === 'failed' || status === 'cancelled' || hasFailedTrack) {
    return resolveFailedStage(trackStatus);
  }

  return resolveRunningStage(currentPhase, trackStatus);
}
