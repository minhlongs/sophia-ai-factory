/**
 * Smart Resume Engine for campaign pipeline checkpoint/resume.
 *
 * Persists pipeline checkpoints so campaigns can resume from
 * the last successful step after failures or interruptions.
 *
 * Uses Supabase `campaign_checkpoints` table when available,
 * falls back to in-memory Map when Supabase is not configured.
 */

import {
  PIPELINE_STEPS,
  getNextStep,
  getStepsFromIndex,
  isValidStep,
  type PipelineStep,
} from '@/tree/gateway/pipeline-step-navigator';
import type { Checkpoint } from '@/tree/gateway/gateway-types';
import { logger } from '@/seed/utils/logger-utility';
import {
  recordSupabaseCheckpoint,
  fetchSupabaseLastCheckpoint,
  removeSupabaseCheckpointsFromStep,
  fetchSupabaseCheckpoints,
  clearSupabaseCheckpoints,
  checkSupabaseStepCompleted,
} from './smart-resume-supabase';

export type { PipelineStep };
export { PIPELINE_STEPS };

/**
 * SmartResumeEngine manages campaign pipeline checkpoints.
 */
export class SmartResumeEngine {
  private fallbackStore: Map<string, Checkpoint[]> = new Map();

  /** Record a checkpoint for a campaign pipeline step */
  async checkpoint(
    campaignId: string,
    step: PipelineStep,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const saved = await recordSupabaseCheckpoint(campaignId, step, metadata);
    if (saved) return;

    const cp: Checkpoint = { campaignId, step, completedAt: new Date(), metadata };
    const existing = this.fallbackStore.get(campaignId) ?? [];
    const filtered = existing.filter((c) => c.step !== step);
    filtered.push(cp);
    this.fallbackStore.set(campaignId, filtered);
  }

  /** Get the most recent checkpoint for a campaign. Returns null on load failure. */
  async getLastCheckpoint(campaignId: string): Promise<Checkpoint | null> {
    const res = await fetchSupabaseLastCheckpoint(campaignId);
    if (res.handled) return res.checkpoint;

    const checkpoints = this.fallbackStore.get(campaignId);
    if (!checkpoints || checkpoints.length === 0) return null;
    return [...checkpoints].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())[0];
  }

  /**
   * Force retry from a specific step by deleting checkpoints at and after that step.
   */
  async retryFromStep(campaignId: string, stepName: PipelineStep): Promise<void> {
    if (!isValidStep(stepName)) {
      logger.warn(`[SmartResumeEngine] Unknown step "${stepName}" for retryFromStep`, { campaignId });
      return;
    }

    const stepsToRemove = getStepsFromIndex(stepName);
    const removed = await removeSupabaseCheckpointsFromStep(campaignId, stepsToRemove);
    if (removed) return;

    const existing = this.fallbackStore.get(campaignId) ?? [];
    this.fallbackStore.set(
      campaignId,
      existing.filter((cp) => !stepsToRemove.includes(cp.step as PipelineStep))
    );
  }

  /** Get all checkpoints for a campaign, ordered by completion time */
  async getCheckpoints(campaignId: string): Promise<Checkpoint[]> {
    const res = await fetchSupabaseCheckpoints(campaignId);
    if (res.handled) return res.checkpoints;

    return [...(this.fallbackStore.get(campaignId) ?? [])].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
    );
  }

  /** Determine the next pipeline step to resume from after a checkpoint */
  async resumeFrom(checkpoint: Checkpoint): Promise<string> {
    return getNextStep(checkpoint.step as string);
  }

  /** Clear all checkpoints for a campaign */
  async clearCheckpoints(campaignId: string): Promise<void> {
    await clearSupabaseCheckpoints(campaignId);
    this.fallbackStore.delete(campaignId);
  }

  /** Check if a specific step has been completed for a campaign */
  async isStepCompleted(campaignId: string, step: string): Promise<boolean> {
    const res = await checkSupabaseStepCompleted(campaignId, step);
    if (res.handled) return res.completed;

    return (this.fallbackStore.get(campaignId) ?? []).some((cp) => cp.step === step);
  }
}
