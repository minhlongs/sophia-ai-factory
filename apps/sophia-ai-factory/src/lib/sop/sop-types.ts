/**
 * SOP Domain Types
 *
 * TypeScript interfaces matching D1 schema rows for sop_templates,
 * user_sop_installations, and sop_runs. All snake_case from DB, camelCase in app.
 */

/** All supported SOP categories */
export type SopCategory = 'content' | 'leads' | 'email' | 'analytics' | 'proposals' | 'crisis' | 'sales' | 'social';

/** Row from sop_templates table */
export interface SopTemplateRow {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string;
  description_en: string;
  category: SopCategory;
  agents_yaml: string;
  playbook_md: string;
  output_schema: string;  // JSON string
  credits_per_run: number;
  version: number;
  is_official: 0 | 1;
  author_user_id: string | null;
  status: 'draft' | 'published' | 'archived';
  created_at: number;
  updated_at: number;
  /** JSON Schema for no-code config form */
  config_schema: string | null;
  /** JSON default values for config form */
  config_defaults: string | null;
  /** Minutes to set up (shown in UI) */
  setup_time_minutes: number;
  /** Whether to show in featured/hero section */
  is_featured: 0 | 1;
}

/** Customizations stored as JSON in user_sop_installations.customizations */
export interface SopCustomizations {
  playbook_md_override?: string;
  agents_yaml_override?: string;
  vars?: Record<string, string>;
  webhookSecret?: string;
}

/** Row from user_sop_installations table */
export interface SopInstallationRow {
  id: string;
  user_id: string;
  template_id: string;
  customizations: string | null;  // JSON string → SopCustomizations
  schedule_cron: string | null;
  enabled: 0 | 1;
  last_run_at: number | null;
  next_run_at: number | null;
  run_count: number;
  created_at: number;
  /** JSON object of customer's form config values */
  config_values: string | null;
}

/** Row from sop_runs table */
export interface SopRunRow {
  id: string;
  installation_id: string;
  trigger_type: 'cron' | 'webhook' | 'manual';
  mission_ids: string;  // JSON array string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial';
  result_summary: string | null;  // JSON string
  error_message: string | null;
  requires_approval: 0 | 1;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
}

/** Input for creating a new installation */
export interface CreateInstallationInput {
  userId: string;
  templateId: string;
  scheduleCron?: string;
  customizations?: SopCustomizations;
  /** Config values from no-code form */
  configValues?: Record<string, unknown>;
}

/** Fields that can be updated on a run */
export interface UpdateRunFields {
  status?: SopRunRow['status'];
  resultSummary?: string;
  errorMessage?: string;
  requiresApproval?: 0 | 1;
  startedAt?: number;
  completedAt?: number;
}
