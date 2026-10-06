/**
 * Autonomous Engine D1 Database Rows & Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/autonomous-db
 */

import type { AutonomousEngineState } from './autonomous-fsm';
import type { AutonomousCapability, ScheduleType, DlqStatus } from './autonomous-engine';

export interface AutonomousLoopStateRow {
  id: string;
  tenant_id?: string;
  state: AutonomousEngineState;
  current_cycle_id: string | null;
  consecutive_failures: number;
  last_error: string | null;
  consciousness_score: number;
  daily_mcu_consumed: number;
  monthly_mcu_consumed: number;
  daily_spend_cents: number;
  monthly_spend_cents: number;
  last_heartbeat_at: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface AutonomousScheduleTaskRow {
  id: string;
  tenant_id?: string;
  skill_name: string;
  capability_name?: AutonomousCapability | string;
  schedule_type: ScheduleType;
  schedule_expression?: string | null;
  cron_expression?: string | null;
  interval_seconds?: number | null;
  event_trigger?: string | null;
  timezone: string;
  tier_requirement: string;
  priority: number;
  max_retries?: number;
  enabled: number; // 0 | 1
  last_run_at: number | null;
  next_run_at: number | null;
  run_count: number;
  failure_count: number;
  lock_token: string | null;
  locked_until: number | null;
  created_at: number;
  updated_at: number;
}

export interface AutonomousDeadLetterRow {
  id: string;
  tenant_id?: string;
  task_id: string;
  skill_name: string;
  payload_json: string;
  error_message: string;
  error_stack?: string | null;
  retry_count: number;
  max_retries: number;
  status: DlqStatus;
  first_failed_at: number;
  last_failed_at: number;
  resolved_at: number | null;
  created_at: number;
}
export type AutonomousDeadLetterQueueRow = AutonomousDeadLetterRow;

export interface AutonomousCycleRunRow {
  id: string;
  tenant_id?: string;
  trigger_type: string;
  state_before: AutonomousEngineState;
  state_after: AutonomousEngineState;
  tasks_attempted?: number;
  tasks_succeeded?: number;
  tasks_failed?: number;
  tasksAttempted?: number;
  tasksSucceeded?: number;
  tasksFailed?: number;
  mcu_consumed?: number;
  tokens_consumed?: number;
  mcuConsumed?: number;
  tokensConsumed?: number;
  cost_cents?: number;
  costCents?: number;
  consciousness_score?: number;
  consciousnessScore?: number;
  duration_ms?: number;
  durationMs?: number;
  error_summary?: string | null;
  errorSummary?: string | null;
  created_at: number;
}
