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
  getCheckpointSupabase,
  rowToCheckpoint,
  type CheckpointRow,
} from "@/tree/gateway/checkpoint-supabase-persistence";
import {
  PIPELINE_STEPS,
  getNextStep,
  getStepsFromIndex,
  isValidStep,
} from "@/tree/gateway/pipeline-step-navigator";
import type { PipelineStep } from "@/tree/gateway/pipeline-step-navigator";
import type { Checkpoint } from "@/tree/gateway/gateway-types";
import { logger } from "@/seed/utils/logger-utility";

export type { PipelineStep };

/**
 * SmartResumeEngine manages campaign pipeline checkpoints.
 *
 * Usage:
 *   const engine = new SmartResumeEngine();
 *   await engine.checkpoint(campaignId, "generate-script", { wordCount: 500 });
 *   const last = await engine.getLastCheckpoint(campaignId);
 *   const nextStep = await engine.resumeFrom(last);
 */
export class SmartResumeEngine {
  private fallbackStore: Map<string, Checkpoint[]> = new Map();

  /** Record a checkpoint for a campaign pipeline step */
  async checkpoint(
    campaignId: string,
    step: PipelineStep,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const supabase = await getCheckpointSupabase();

    if (supabase) {
      try {
        // Upsert relies on the table's UNIQUE constraint on (campaign_id, step);
        // the prior `{ onConflict: 'campaign_id,step' }` second arg was a
        // Supabase-only hint that D1 ignores — its bare `ON CONFLICT DO UPDATE`
        // clause picks the constraint from the row shape.
        const { error } = await supabase
          .from("campaign_checkpoints")
          .upsert({ campaign_id: campaignId, step, completed_at: new Date().toISOString(), metadata: metadata ?? null });
        if (error) throw error;
        return;
      } catch (err) {
        logger.error(`[SmartResumeEngine] Failed to record checkpoint for ${campaignId}`, err instanceof Error ? err : undefined);
      }
    }

    const cp: Checkpoint = { campaignId, step, completedAt: new Date(), metadata };
    const existing = this.fallbackStore.get(campaignId) ?? [];
    const filtered = existing.filter((c) => c.step !== step);
    filtered.push(cp);
    this.fallbackStore.set(campaignId, filtered);
  }

  /** Get the most recent checkpoint for a campaign. Returns null on load failure. */
  async getLastCheckpoint(campaignId: string): Promise<Checkpoint | null> {
    const supabase = await getCheckpointSupabase();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("campaign_checkpoints")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("completed_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        if (!data || data.length === 0) return null;
        return rowToCheckpoint(data[0] as unknown as CheckpointRow);
      } catch (err) {
        logger.error(`[SmartResumeEngine] Failed to retrieve last checkpoint for ${campaignId}, starting from beginning`, err instanceof Error ? err : undefined);
        return null;
      }
    }

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
    const supabase = await getCheckpointSupabase();

    if (supabase) {
      try {
        const { error } = await supabase
          .from("campaign_checkpoints")
          .delete()
          .eq("campaign_id", campaignId)
          .in("step", stepsToRemove as string[]);
        if (error) throw error;
        logger.info(`[SmartResumeEngine] Cleared checkpoints from step "${stepName}" for retry`, { campaignId });
        return;
      } catch (err) {
        logger.error(`[SmartResumeEngine] Failed to clear checkpoints for retryFromStep`, err instanceof Error ? err : undefined, { campaignId });
      }
    }

    const existing = this.fallbackStore.get(campaignId) ?? [];
    this.fallbackStore.set(
      campaignId,
      existing.filter((cp) => !stepsToRemove.includes(cp.step as PipelineStep))
    );
  }

  /** Get all checkpoints for a campaign, ordered by completion time */
  async getCheckpoints(campaignId: string): Promise<Checkpoint[]> {
    const supabase = await getCheckpointSupabase();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("campaign_checkpoints")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("completed_at", { ascending: true });
        if (error) throw error;
        if (!data) return [];
        return (data as unknown as CheckpointRow[]).map(rowToCheckpoint);
      } catch (err) {
        logger.error(`[SmartResumeEngine] Failed to retrieve checkpoints for ${campaignId}`, err instanceof Error ? err : undefined);
      }
    }

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
    const supabase = await getCheckpointSupabase();

    if (supabase) {
      try {
        const { error } = await supabase
          .from("campaign_checkpoints")
          .delete()
          .eq("campaign_id", campaignId);
        if (error) throw error;
        this.fallbackStore.delete(campaignId);
        return;
      } catch (err) {
        logger.error(`[SmartResumeEngine] Failed to clear checkpoints for ${campaignId}`, err instanceof Error ? err : undefined);
      }
    }

    this.fallbackStore.delete(campaignId);
  }

  /** Check if a specific step has been completed for a campaign */
  async isStepCompleted(campaignId: string, step: string): Promise<boolean> {
    const supabase = await getCheckpointSupabase();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("campaign_checkpoints")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("step", step)
          .limit(1);
        if (error) throw error;
        return (data?.length ?? 0) > 0;
      } catch (err) {
        logger.error(`[SmartResumeEngine] Failed to check step completion for ${campaignId}`, err instanceof Error ? err : undefined);
      }
    }

    return (this.fallbackStore.get(campaignId) ?? []).some((cp) => cp.step === step);
  }
}

// Re-export PIPELINE_STEPS for consumers that imported it from this module
export { PIPELINE_STEPS };
