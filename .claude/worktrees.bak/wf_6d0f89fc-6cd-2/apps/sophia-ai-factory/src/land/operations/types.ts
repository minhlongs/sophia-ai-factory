/**
 * SOP (Standard Operating Procedure) type definitions for the land/operations layer.
 *
 * Each SOP describes a complete revenue-generating workflow with bilingual metadata
 * (English + Vietnamese), step-by-step instructions, tool configuration, and
 * estimated revenue ranges.
 *
 * @module land/operations/types
 */

export type SopCategory = 'content' | 'business' | 'marketing' | 'operations';
export type SopDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SopStepDef {
  order: number;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  tool: string;
  tool_config: Record<string, unknown>;
  estimated_minutes: number;
  is_automated: boolean;
}

export interface SopDefinition {
  slug: string;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  category: SopCategory;
  difficulty: SopDifficulty;
  estimated_revenue_min: number;
  estimated_revenue_max: number;
  setup_time_minutes: number;
  credits_per_run: number;
  steps: SopStepDef[];
}
