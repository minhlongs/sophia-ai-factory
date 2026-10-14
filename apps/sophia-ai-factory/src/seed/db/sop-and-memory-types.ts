/**
 * SOP Engine and Creator Memory D1 table row types.
 * @module seed/db/sop-and-memory-types
 */

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

export type CreatorMemoryType = 'episodic' | 'semantic' | 'preference' | 'performance';

export type CreatorMemoryDbRow = {
  id: string;
  user_id: string;
  memory_type: CreatorMemoryType;
  category: string;
  content_json: string;
  relevance_score: number;
  source_execution_id: string | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
};

export type CreatorProfile = {
  semantic: Record<string, unknown>;
  preferences: Record<string, unknown>;
};
