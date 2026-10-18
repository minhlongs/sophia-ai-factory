/**
 * Supabase persistence helpers for SmartResumeEngine.
 * @module tree/gateway/smart-resume-supabase
 */

import { getCheckpointSupabase } from '@/tree/gateway/checkpoint-supabase-persistence';
import type { PipelineStep } from '@/tree/gateway/pipeline-step-navigator';
import { logger } from '@/seed/utils/logger-utility';

export {
  fetchSupabaseLastCheckpoint,
  fetchSupabaseCheckpoints,
  checkSupabaseStepCompleted,
} from './smart-resume-supabase-queries';

export async function recordSupabaseCheckpoint(
  campaignId: string,
  step: PipelineStep,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const supabase = await getCheckpointSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('campaign_checkpoints')
      .upsert({
        campaign_id: campaignId,
        step,
        completed_at: new Date().toISOString(),
        metadata: metadata ?? null,
      });
    if (error) throw error;
    return true;
  } catch (err) {
    logger.error(
      `[SmartResumeEngine] Failed to record checkpoint for ${campaignId}`,
      err instanceof Error ? err : undefined,
    );
    return false;
  }
}

export async function removeSupabaseCheckpointsFromStep(
  campaignId: string,
  stepsToRemove: readonly string[],
): Promise<boolean> {
  const supabase = await getCheckpointSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('campaign_checkpoints')
      .delete()
      .eq('campaign_id', campaignId)
      .in('step', stepsToRemove as string[]);
    if (error) throw error;
    return true;
  } catch (err) {
    logger.error(
      `[SmartResumeEngine] Failed to clear checkpoints for retryFromStep`,
      err instanceof Error ? err : undefined,
      { campaignId },
    );
    return false;
  }
}

export async function clearSupabaseCheckpoints(campaignId: string): Promise<boolean> {
  const supabase = await getCheckpointSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('campaign_checkpoints')
      .delete()
      .eq('campaign_id', campaignId);
    if (error) throw error;
    return true;
  } catch (err) {
    logger.error(
      `[SmartResumeEngine] Failed to clear checkpoints for ${campaignId}`,
      err instanceof Error ? err : undefined,
    );
    return false;
  }
}
