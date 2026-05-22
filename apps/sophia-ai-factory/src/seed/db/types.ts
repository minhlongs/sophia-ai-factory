/**
 * Shared generic types for the D1 query layer.
 *
 * Keep this file free of runtime code — interfaces and type aliases only.
 */

/** Generic D1 query response shape for `.single()` / raw-chain awaits. */
export type D1Response<T> = {
  data: T | null
  error: unknown
}

// ── Agent Factory table row types ─────────────────────────────────────────

export type AgentTeamDbRow = {
  id: string
  org_id: string
  name: string
  config: string
  created_at: string
  updated_at: string
}

export type AgentDbRow = {
  id: string
  team_id: string
  role: 'CEO' | 'Developer'
  name: string
  system_prompt: string
  model: string
  enabled: number
  created_at: string
}

export type AgentTaskDbRow = {
  id: string
  org_id: string
  agent_id: string
  input: string
  output: string | null
  status: 'queued' | 'running' | 'completed' | 'failed'
  error_message: string | null
  tokens_used: number
  cost_usd: number
  created_at: string
  completed_at: string | null
}

export type AgentLogDbRow = {
  id: string
  task_id: string
  action: string
  payload: string
  created_at: string
}

// ── Engine Missions table row type (0052 columns) ─────────────────────
// Note: BYOK columns (byok_provider_id, byok_model_id) were added to the
// canonical `missions` table via migration 0097, NOT to engine_missions.

export type EngineMissionDbRow = {
  id: string
  user_id: string
  command: string
  params: string | null
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  result: string | null
  error: string | null
  credits_used: number
  created_at: number
  updated_at: number
  completed_at: number | null
  webhook_url: string | null
  webhook_fired_at: number | null
}

// ── SOP Engine table row types (Phase 01 Solo SOPs Platform) ─────────

export type SopCategory = 'content' | 'business' | 'marketing' | 'operations';
export type SopDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type SopStatus = 'draft' | 'published' | 'archived';
export type SopExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type SopStepDefinition = {
  order: number;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  tool: string;
  tool_config: Record<string, unknown>;
  estimated_minutes: number;
  is_automated: boolean;
};

export type SopTemplateDbRow = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
  category: SopCategory;
  difficulty: SopDifficulty;
  estimated_revenue_min: number | null;
  estimated_revenue_max: number | null;
  setup_time_minutes: number;
  credits_per_run: number;
  version: number;
  steps_json: string;
  input_schema: string;
  output_schema: string;
  is_featured: number;
  is_official: number;
  status: SopStatus;
  author_user_id: string | null;
  created_at: number;
  updated_at: number;
};

export type UserSopInstallationDbRow = {
  id: string;
  user_id: string;
  org_id: string;
  sop_template_id: string;
  config_overrides: string | null;
  custom_name: string | null;
  notes: string | null;
  total_runs: number;
  total_credits_spent: number;
  installed_at: number;
  last_run_at: number | null;
};

export type SopStepResult = {
  step_order: number;
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: number | null;
  completed_at: number | null;
  duration_ms: number | null;
};

export type SopExecutionDbRow = {
  id: string;
  user_id: string;
  org_id: string;
  sop_template_id: string;
  installation_id: string | null;
  status: SopExecutionStatus;
  input_json: string;
  output_json: string | null;
  error_message: string | null;
  current_step: number;
  total_steps: number;
  step_results: string;
  credits_used: number;
  started_at: number;
  completed_at: number | null;
};
