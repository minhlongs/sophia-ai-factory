/**
 * Multi-Track Execution Bridge — Tree Layer
 * Layer: tree (domain-specific reusable)
 *
 * Provides dependency inversion: decouples land/creative-mission actions
 * from the forest multi-track orchestrator. Supports direct invocation
 * when registered, with resilient fallback to Inngest background event dispatch.
 *
 * @module tree/mission/executor-bridge
 */

import { inngest } from '@/seed/inngest/client';
import { sendInngestWithRetry } from '@/seed/inngest/send-with-retry';
import { logger } from '@/seed/utils/logger-utility';
import type {
  MultiTrackExecutionResult,
  MissionTrackStatus,
} from './types';

export interface MultiTrackDispatchOptions {
  userId?: string;
  workspaceId?: string;
  topic?: string;
  voiceStyle?: string;
  voiceId?: string;
  estimatedScenes?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  estimatedCostCents?: number;
  [key: string]: unknown;
}

export type MultiTrackExecutorFn = (
  missionId: string,
  options?: MultiTrackDispatchOptions,
) => Promise<MultiTrackExecutionResult>;

let registeredExecutor: MultiTrackExecutorFn | null = null;

export function registerMultiTrackExecutor(executor: MultiTrackExecutorFn): void {
  registeredExecutor = executor;
}

export function getRegisteredExecutor(): MultiTrackExecutorFn | null {
  return registeredExecutor;
}

export async function dispatchMultiTrackMission(
  missionId: string,
  options: MultiTrackDispatchOptions = {},
): Promise<MultiTrackExecutionResult> {
  // Direct in-memory invocation if registered (tests, local dev, direct runners)
  if (registeredExecutor) {
    return registeredExecutor(missionId, options);
  }

  logger.info('[ExecutorBridge] Dispatching multi-track mission via Inngest', {
    missionId,
    workspaceId: options.workspaceId,
  });

  // Production asynchronous background dispatch via Inngest
  const eventId = `mt_${missionId}_${Date.now()}`;
  await sendInngestWithRetry(() =>
    inngest.send({
      id: eventId,
      name: 'creative.mission.multitrack.requested',
      data: {
        missionId,
        userId: options.userId || '',
        workspaceId: options.workspaceId || '',
        topic: options.topic,
        estimatedScenes: options.estimatedScenes,
        durationSeconds: options.durationSeconds,
        aspectRatio: options.aspectRatio as '16:9' | '9:16' | '1:1' | undefined,
        estimatedCostCents: options.estimatedCostCents,
      },
      ts: Date.now(),
    }),
  );

  const initialTrackStatus: MissionTrackStatus = {
    script: 'pending',
    audio: 'pending',
    visual: 'pending',
    video: 'pending',
  };

  return {
    success: true,
    missionId,
    workspaceId: options.workspaceId || '',
    status: 'running',
    currentPhase: 'executing',
    trackStatus: initialTrackStatus,
    tracks: {},
  };
}
