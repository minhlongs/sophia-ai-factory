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
} from "./checkpoint-supabase-persistence";

/** A single pipeline checkpoint recording a completed step */
export interface Checkpoint {
  campaignId: string;
  step: string;
  completedAt: Date;
  metadata?: Record<string, unknown>;
}

/** Pipeline step definitions and their order */
const PIPELINE_STEPS = [
  "notify-start",
  "generate-script",
  "generate-voiceover",
  "start-video-generation",
  "poll-video-status",
  "distribute-channels",
  "finalize-campaign",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

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
    step: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const supabase = getCheckpointSupabase();

    if (supabase) {
      try {
        const { error } = await supabase
          .from("campaign_checkpoints")
          .upsert(
            {
              campaign_id: campaignId,
              step,
              completed_at: new Date().toISOString(),
              metadata: metadata ?? null,
            },
            { onConflict: "campaign_id,step" }
          );
        if (error) throw error;
        return;
      } catch (err) {
        console.warn("[SmartResumeEngine] Supabase write failed, falling back to memory:", err);
      }
    }

    const cp: Checkpoint = { campaignId, step, completedAt: new Date(), metadata };
    const existing = this.fallbackStore.get(campaignId) ?? [];
    const filtered = existing.filter((c) => c.step !== step);
    filtered.push(cp);
    this.fallbackStore.set(campaignId, filtered);
  }

  /** Get the most recent checkpoint for a campaign */
  async getLastCheckpoint(campaignId: string): Promise<Checkpoint | null> {
    const supabase = getCheckpointSupabase();

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
        return rowToCheckpoint(data[0] as CheckpointRow);
      } catch (err) {
        console.warn("[SmartResumeEngine] Supabase read failed, falling back to memory:", err);
      }
    }

    const checkpoints = this.fallbackStore.get(campaignId);
    if (!checkpoints || checkpoints.length === 0) return null;
    const sorted = [...checkpoints].sort(
      (a, b) => b.completedAt.getTime() - a.completedAt.getTime(),
    );
    return sorted[0];
  }

  /** Get all checkpoints for a campaign, ordered by completion time */
  async getCheckpoints(campaignId: string): Promise<Checkpoint[]> {
    const supabase = getCheckpointSupabase();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("campaign_checkpoints")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("completed_at", { ascending: true });
        if (error) throw error;
        if (!data) return [];
        return (data as CheckpointRow[]).map(rowToCheckpoint);
      } catch (err) {
        console.warn("[SmartResumeEngine] Supabase read failed, falling back to memory:", err);
      }
    }

    const checkpoints = this.fallbackStore.get(campaignId) ?? [];
    return [...checkpoints].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
    );
  }

  /** Determine the next pipeline step to resume from after a checkpoint */
  async resumeFrom(checkpoint: Checkpoint): Promise<string> {
    const currentIndex = PIPELINE_STEPS.indexOf(checkpoint.step as PipelineStep);
    if (currentIndex === -1) return PIPELINE_STEPS[0];
    const nextIndex = currentIndex + 1;
    if (nextIndex >= PIPELINE_STEPS.length) return "complete";
    return PIPELINE_STEPS[nextIndex];
  }

  /** Clear all checkpoints for a campaign */
  async clearCheckpoints(campaignId: string): Promise<void> {
    const supabase = getCheckpointSupabase();

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
        console.warn("[SmartResumeEngine] Supabase delete failed, falling back to memory:", err);
      }
    }

    this.fallbackStore.delete(campaignId);
  }

  /** Check if a specific step has been completed for a campaign */
  async isStepCompleted(campaignId: string, step: string): Promise<boolean> {
    const supabase = getCheckpointSupabase();

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
        console.warn("[SmartResumeEngine] Supabase query failed, falling back to memory:", err);
      }
    }

    const checkpoints = this.fallbackStore.get(campaignId) ?? [];
    return checkpoints.some((cp) => cp.step === step);
  }
}
