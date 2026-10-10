/**
 * @module forest/playbook/scheduler/types
 * Type contracts for recurring campaign batch scheduling.
 */

export interface BatchRunResult {
  processed: number;
  dispatched: number;
  skippedQuota: number;
  skippedPreflight: number;
  failures: string[];
}

export interface ScheduledCampaignRow {
  id: string;
  workspace_id?: string | null;
  user_id: string;
  topic: string;
  template_script?: string | null;
  interval_days?: number | null;
  next_run_date: string;
  last_run_date?: string | null;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}
