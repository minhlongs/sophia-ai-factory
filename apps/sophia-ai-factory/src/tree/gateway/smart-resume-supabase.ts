/**
 * Supabase persistence helpers for SmartResumeEngine.
 * @module tree/gateway/smart-resume-supabase
 */

import {
  getCheckpointSupabase,
  rowToCheckpoint,
  type CheckpointRow,
} from '@/tree/gateway/checkpoint-supabase-persistence';
import type { Checkpoint } from '@/tree/gateway/gateway-types';
import type { PipelineStep } from '@/tree/gateway/pipeline-step-navigator';
import { logger } from '@/seed/utils/logger-utility';

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

export async function fetchSupabaseLastCheckpoint(
  campaignId: string,
): Promise<{ handled: boolean; checkpoint: Checkpoint | null }> {
  const supabase = await getCheckpointSupabase();
  if (!supabase) return { handled: false, checkpoint: null };

  try {
    const { data, error } = await supabase
      .from('campaign_checkpoints')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('completed_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return { handled: true, checkpoint: null };
    return {
      handled: true,
      checkpoint: rowToCheckpoint(data[0] as unknown as CheckpointRow),
    };
  } catch (err) {
    logger.error(
      `[SmartResumeEngine] Failed to retrieve last checkpoint for ${campaignId}, starting from beginning`,
      err instanceof Error ? err : undefined,
    );
    return { handled: true, checkpoint: null };
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

export async function fetchSupabaseCheckpoints(
  campaignId: string,
): Promise<{ handled: boolean; checkpoints: Checkpoint[] }> {
  const supabase = await getCheckpointSupabase();
  if (!supabase) return { handled: false, checkpoints: [] };

  try {
    const { data, error } = await supabase
      .from('campaign_checkpoints')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('completed_at', { ascending: true });
    if (error) throw error;
    if (!data) return { handled: true, checkpoints: [] };
    return {
      handled: true,
      checkpoints: (data as unknown as CheckpointRow[]).map(rowToCheckpoint),
    };
  } catch (err) {
    logger.error(
      `[SmartResumeEngine] Failed to retrieve checkpoints for ${campaignId}`,
      err instanceof Error ? err : undefined,
    );
    return { handled: true, checkpoints: [] };
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

export async function checkSupabaseStepCompleted(
  campaignId: string,
  step: string,
): Promise<{ handled: boolean; completed: boolean }> {
  const supabase = await getCheckpointSupabase();
  if (!supabase) return { handled: false, completed: false };

  try {
    const { data, error } = await supabase
      .from('campaign_checkpoints')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('step', step)
      .limit(1);
    if (error) throw error;
    return { handled: true, completed: (data?.length ?? 0) > 0 };
  } catch (err) {
    logger.error(
      `[SmartResumeEngine] Failed to check step completion for ${campaignId}`,
      err instanceof Error ? err : undefined,
    );
    return { handled: true, completed: false };
  }
}
