/**
 * Playbook Pattern & Rule Definitions
 */

/** A single detected winning pattern across one feature dimension */
export interface PlaybookPattern {
  id: string;
  workspaceId: string;
  featureKey: string; // e.g. 'hook_type', 'duration', 'channel', 'posting_time_bucket'
  featureValue: string; // e.g. 'curiosity_gap', '60s', 'tiktok', 'prime'
  metric: string; // e.g. 'ctr', 'conversion_rate', 'revenue_per_view'
  avgMetric: number;
  sampleSize: number;
  confidence: number; // 0..1
  confidenceLevel: 'high' | 'medium' | 'low';
  source: 'mission' | 'experiment' | 'memory' | 'roi';
  detectedAt: number;
}

/** A human-readable rule derived from a pattern, grouped by platform + goal */
export interface PlaybookRule {
  id: string;
  workspaceId: string;
  patternId: string;
  platform: string; // ChannelProvider value
  goal: string; // e.g. 'awareness', 'conversion', 'retention'
  ruleVi: string;
  ruleEn: string;
  confidence: number;
  sampleSize: number;
  appliedCount: number;
  autoApply: boolean; // true when confidence > 0.9
  rollbackCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Row shape as read from D1 (all snake_case) */
export interface PlaybookPatternRow {
  id: string;
  workspace_id: string;
  feature_key: string;
  feature_value: string;
  metric: string;
  avg_metric: number;
  sample_size: number;
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low';
  source: string;
  detected_at: number;
}

export interface PlaybookRuleRow {
  id: string;
  workspace_id: string;
  pattern_id: string;
  platform: string;
  goal: string;
  rule_vi: string;
  rule_en: string;
  confidence: number;
  sample_size: number;
  applied_count: number;
  auto_apply: number;
  rollback_count: number;
  created_at: number;
  updated_at: number;
}

/** Result of a detection run — either patterns or an insufficient-data notice */
export interface PatternDetectionResult {
  patterns: PlaybookPattern[];
  insufficientData: boolean;
  reason?: string;
  scannedAt: number;
}

/** Hook style classification for script introductions */
export type HookStyle =
  | 'curiosity_gap'
  | 'bold_claim'
  | 'problem_agitation'
  | 'question'
  | 'story_lead'
  | 'statistic_reveal';

/** Voice style profile for audio narration */
export type VoiceProfile =
  | 'dynamic_hook'
  | 'enthusiastic_recommender'
  | 'calm_authoritative'
  | 'cinematic_narrator';

/** Duration grouping pattern for short-form video content */
export type DurationPattern = '0-15s' | '16-30s' | '31-60s' | '61-90s' | '90s+';
