/**
 * Supabase checkpoint persistence helpers for SmartResumeEngine.
 *
 * Provides lazy-initialized Supabase client and row-to-checkpoint
 * conversion for the campaign_checkpoints table.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Checkpoint } from "@/tree/gateway/gateway-types";

/** Row shape returned from campaign_checkpoints table */
export interface CheckpointRow {
  id: string;
  campaign_id: string;
  step: string;
  completed_at: string;
  metadata: Record<string, unknown> | null;
}

/** Get D1 client for checkpoint persistence, null if unavailable */
export async function getCheckpointSupabase(): Promise<any | null> {
  try {
    return await createAdminClient();
  } catch {
    return null;
  }
}

/** Convert a Supabase row to a Checkpoint object */
export function rowToCheckpoint(row: CheckpointRow): Checkpoint {
  return {
    campaignId: row.campaign_id,
    step: row.step,
    completedAt: new Date(row.completed_at),
    metadata: row.metadata ?? undefined,
  };
}

/**
 * Reset stub kept for backward compatibility with tests.
 * @internal
 */
export function _resetSupabaseState(): void {
  // No-op: D1 client has no lazy-init state to reset
}
