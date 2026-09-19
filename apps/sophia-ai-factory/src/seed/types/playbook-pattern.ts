/**
 * Playbook Pattern Types — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Shared types for detected winning patterns and derived playbook rules.
 * Layer: seed (primitives — no domain logic here)
 */

/** A single detected winning pattern across one feature dimension */
export interface PlaybookPattern {
  id: string
  workspaceId: string
  featureKey: string        // e.g. 'hook_type', 'duration', 'channel', 'posting_time_bucket'
  featureValue: string      // e.g. 'curiosity_gap', '60s', 'tiktok', 'prime'
  metric: string            // e.g. 'ctr', 'conversion_rate', 'revenue_per_view'
  avgMetric: number
  sampleSize: number
  confidence: number        // 0..1
  confidenceLevel: 'high' | 'medium' | 'low'
  source: 'mission' | 'experiment' | 'memory' | 'roi'
  detectedAt: number
}

/** A human-readable rule derived from a pattern, grouped by platform + goal */
export interface PlaybookRule {
  id: string
  workspaceId: string
  patternId: string
  platform: string         // ChannelProvider value
  goal: string             // e.g. 'awareness', 'conversion', 'retention'
  ruleVi: string
  ruleEn: string
  confidence: number
  sampleSize: number
  appliedCount: number
  autoApply: boolean       // true when confidence > 0.9
  rollbackCount: number
  createdAt: number
  updatedAt: number
}

/** Row shape as read from D1 (all snake_case) */
export interface PlaybookPatternRow {
  id: string
  workspace_id: string
  feature_key: string
  feature_value: string
  metric: string
  avg_metric: number
  sample_size: number
  confidence: number
  confidence_level: 'high' | 'medium' | 'low'
  source: string
  detected_at: number
}

export interface PlaybookRuleRow {
  id: string
  workspace_id: string
  pattern_id: string
  platform: string
  goal: string
  rule_vi: string
  rule_en: string
  confidence: number
  sample_size: number
  applied_count: number
  auto_apply: number
  rollback_count: number
  created_at: number
  updated_at: number
}

/** Result of a detection run — either patterns or an insufficient-data notice */
export interface PatternDetectionResult {
  patterns: PlaybookPattern[]
  insufficientData: boolean
  reason?: string
  scannedAt: number
}

// ── Phase 5 Intelligence Extensions ──────────────────────────────────────────

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

/** Repeatable campaign blueprint synthesized from winning patterns */
export interface CampaignBlueprint {
  id: string;
  workspaceId: string;
  name: { en: string; vi: string };
  description: { en: string; vi: string };
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
  hookStyle: HookStyle;
  voiceStyle: VoiceProfile;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  estimatedScenes: number;
  suggestedPrompts: Array<{ en: string; vi: string }>;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  estimatedCostCents?: number;
  targetChannels?: string[];
  sourcePatternIds?: string[];
}

/** Row shape for campaign_blueprints as stored in D1 */
export interface CampaignBlueprintRow {
  id: string;
  workspace_id: string;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  target_platform: string;
  hook_style: string;
  voice_style: string;
  duration_seconds: number;
  aspect_ratio: string;
  estimated_scenes: number;
  suggested_prompts: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

/** Recurring campaign schedule for automated batch generation */
export interface RecurringCampaignSchedule {
  id: string;
  workspaceId: string;
  userId: string;
  blueprintId: string;
  scheduleCron: string;
  batchSize: number;
  nextRunAt: number;
  lastRunAt: number | null;
  isActive: boolean;
  totalRuns: number;
  lastStatus: 'idle' | 'running' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

/** Row shape for recurring_campaign_runs as stored in D1 */
export interface RecurringCampaignScheduleRow {
  id: string;
  workspace_id: string;
  user_id: string;
  blueprint_id: string;
  schedule_cron: string;
  batch_size: number;
  next_run_at: number;
  last_run_at: number | null;
  is_active: number;
  total_runs: number;
  last_status: string;
  created_at: number;
  updated_at: number;
}

/** Composite creative effectiveness scoring result */
export interface CreativeEffectivenessScore {
  score: number; // 0..100
  ctr: number; // 0..1
  retentionRate: number; // 0..1
  conversionRate: number; // 0..1
  efficiencyScore: number; // 0..1
  confidence: number; // 0..1
  confidenceLevel: 'high' | 'medium' | 'low';
  sampleSize: number;
}

/** Input metrics for creative effectiveness scoring */
export interface CreativeMetricsInput {
  impressions?: number;
  views?: number;
  clicks?: number;
  conversions?: number;
  spendCents?: number;
  revenueCents?: number;
  watchTimeSeconds?: number;
  totalDurationSeconds?: number;
  retentionRate?: number;
  ctr?: number;
  conversionRate?: number;
  efficiencyScore?: number;
  sampleSize?: number;
}

/** Result of an atomic Compare-And-Swap (CAS) update */
export interface CASUpdateResult {
  success: boolean;
  changes: number;
  retries: number;
  error?: string;
}

/** Payload for pattern score CAS update */
export interface PatternScoreUpdates {
  avgMetric: number;
  sampleSize: number;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}