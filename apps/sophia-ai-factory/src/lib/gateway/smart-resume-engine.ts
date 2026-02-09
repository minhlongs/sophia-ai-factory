/**
 * Smart Resume Engine for campaign pipeline checkpoint/resume.
 *
 * Persists pipeline checkpoints so campaigns can resume from
 * the last successful step after failures or interruptions.
 *
 * Currently uses in-memory Map storage.
 * TODO: Migrate to Supabase `campaign_checkpoints` table for persistence.
 */

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
  // TODO: Replace with Supabase table `campaign_checkpoints`
  // Schema: id (uuid), campaign_id (text), step (text),
  //         completed_at (timestamptz), metadata (jsonb)
  private store: Map<string, Checkpoint[]> = new Map();

  /** Record a checkpoint for a campaign pipeline step */
  async checkpoint(
    campaignId: string,
    step: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const checkpoint: Checkpoint = {
      campaignId,
      step,
      completedAt: new Date(),
      metadata,
    };

    const existing = this.store.get(campaignId) ?? [];
    // Remove any previous checkpoint for the same step
    const filtered = existing.filter((cp) => cp.step !== step);
    filtered.push(checkpoint);
    this.store.set(campaignId, filtered);
  }

  /** Get the most recent checkpoint for a campaign */
  async getLastCheckpoint(campaignId: string): Promise<Checkpoint | null> {
    const checkpoints = this.store.get(campaignId);
    if (!checkpoints || checkpoints.length === 0) return null;

    // Sort by completedAt descending, return the latest
    const sorted = [...checkpoints].sort(
      (a, b) => b.completedAt.getTime() - a.completedAt.getTime(),
    );
    return sorted[0];
  }

  /** Get all checkpoints for a campaign, ordered by completion time */
  async getCheckpoints(campaignId: string): Promise<Checkpoint[]> {
    const checkpoints = this.store.get(campaignId) ?? [];
    return [...checkpoints].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
    );
  }

  /**
   * Determine the next pipeline step to resume from after a checkpoint.
   * Returns the step name following the checkpoint's step in the pipeline.
   */
  async resumeFrom(checkpoint: Checkpoint): Promise<string> {
    const currentIndex = PIPELINE_STEPS.indexOf(
      checkpoint.step as PipelineStep,
    );

    if (currentIndex === -1) {
      // Unknown step - start from the beginning
      return PIPELINE_STEPS[0];
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= PIPELINE_STEPS.length) {
      // Already at the last step - pipeline is complete
      return "complete";
    }

    return PIPELINE_STEPS[nextIndex];
  }

  /** Clear all checkpoints for a campaign (e.g., after successful completion) */
  async clearCheckpoints(campaignId: string): Promise<void> {
    this.store.delete(campaignId);
  }

  /** Check if a specific step has been completed for a campaign */
  async isStepCompleted(
    campaignId: string,
    step: string,
  ): Promise<boolean> {
    const checkpoints = this.store.get(campaignId) ?? [];
    return checkpoints.some((cp) => cp.step === step);
  }
}
