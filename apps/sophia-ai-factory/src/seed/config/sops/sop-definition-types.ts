/**
 * SOP (Standard Operating Procedure) type definitions.
 *
 * @module seed/config/sops/sop-definition-types
 */

/**
 * Official SOP (Standard Operating Procedure) definitions for the Solo SOPs Platform.
 *
 * Each SOP describes a complete revenue-generating workflow with bilingual metadata
 * (English + Vietnamese), step-by-step instructions, tool configuration, and
 * estimated revenue ranges.
 *
 * @module seed/config/sops/sop-definitions
 */

export type SopDefinition = {
  slug: string;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  category: 'content' | 'business' | 'marketing' | 'operations';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_revenue_min: number;
  estimated_revenue_max: number;
  setup_time_minutes: number;
  credits_per_run: number;
  steps: SopStepDef[];
};

export type SopStepDef = {
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

