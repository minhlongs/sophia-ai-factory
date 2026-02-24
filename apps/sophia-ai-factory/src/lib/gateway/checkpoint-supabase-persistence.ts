/**
 * Supabase checkpoint persistence helpers for SmartResumeEngine.
 *
 * Provides lazy-initialized Supabase client and row-to-checkpoint
 * conversion for the campaign_checkpoints table.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Checkpoint } from "./gateway-types";

/** Row shape returned from Supabase campaign_checkpoints table */
export interface CheckpointRow {
  id: string;
  campaign_id: string;
  step: string;
  completed_at: string;
  metadata: Record<string, unknown> | null;
}

/** Lazy-init Supabase client for checkpoint persistence */
let _supabase: SupabaseClient | null = null;
let _supabaseChecked = false;
let _supabaseAvailable = false;

/** Get Supabase client if configured, null otherwise */
export function getCheckpointSupabase(): SupabaseClient | null {
  if (!_supabaseChecked) {
    _supabaseChecked = true;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabase = createClient(url, key);
      _supabaseAvailable = true;
    }
  }
  return _supabaseAvailable ? _supabase : null;
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
 * Reset the lazy-init state (for testing purposes only).
 * @internal
 */
export function _resetSupabaseState(): void {
  _supabase = null;
  _supabaseChecked = false;
  _supabaseAvailable = false;
}
