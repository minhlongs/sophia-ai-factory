/**
 * Row to Domain Entity Mappers for Playbook Overview.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/overview-mappers
 */

import type {
  PlaybookPattern,
  PlaybookRule,
  PlaybookPatternRow,
  PlaybookRuleRow,
  CampaignBlueprint,
  CampaignBlueprintRow,
  RecurringCampaignSchedule,
  RecurringCampaignScheduleRow,
} from '@/seed/types/playbook-pattern';

export function mapPatternRow(r: PlaybookPatternRow): PlaybookPattern {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    featureKey: r.feature_key,
    featureValue: r.feature_value,
    metric: r.metric,
    avgMetric: Number(r.avg_metric ?? 0),
    sampleSize: Number(r.sample_size ?? 0),
    confidence: Number(r.confidence ?? 0),
    confidenceLevel: r.confidence_level ?? 'low',
    source: (r.source as PlaybookPattern['source']) || 'mission',
    detectedAt: Number(r.detected_at ?? 0),
  };
}

export function mapRuleRow(r: PlaybookRuleRow): PlaybookRule {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    patternId: r.pattern_id,
    platform: r.platform,
    goal: r.goal,
    ruleVi: r.rule_vi,
    ruleEn: r.rule_en,
    confidence: Number(r.confidence ?? 0),
    sampleSize: Number(r.sample_size ?? 0),
    appliedCount: Number(r.applied_count ?? 0),
    autoApply: Boolean(r.auto_apply),
    rollbackCount: Number(r.rollback_count ?? 0),
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  };
}

export function mapBlueprintRow(r: CampaignBlueprintRow): CampaignBlueprint {
  let prompts: Array<{ en: string; vi: string }> = [];
  try {
    prompts = typeof r.suggested_prompts === 'string' ? JSON.parse(r.suggested_prompts) : (r.suggested_prompts ?? []);
  } catch {
    prompts = [];
  }
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: { en: r.name_en, vi: r.name_vi },
    description: { en: r.description_en, vi: r.description_vi },
    targetPlatform: r.target_platform as CampaignBlueprint['targetPlatform'],
    hookStyle: r.hook_style as CampaignBlueprint['hookStyle'],
    voiceStyle: r.voice_style as CampaignBlueprint['voiceStyle'],
    durationSeconds: Number(r.duration_seconds ?? 60),
    aspectRatio: r.aspect_ratio as CampaignBlueprint['aspectRatio'],
    estimatedScenes: Number(r.estimated_scenes ?? 3),
    suggestedPrompts: prompts,
    isActive: Boolean(r.is_active),
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  };
}

export function mapRecurringScheduleRow(r: RecurringCampaignScheduleRow): RecurringCampaignSchedule {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    blueprintId: r.blueprint_id,
    scheduleCron: r.schedule_cron,
    batchSize: Number(r.batch_size ?? 1),
    nextRunAt: Number(r.next_run_at ?? 0),
    lastRunAt: r.last_run_at ? Number(r.last_run_at) : null,
    isActive: Boolean(r.is_active),
    totalRuns: Number(r.total_runs ?? 0),
    lastStatus: (r.last_status as RecurringCampaignSchedule['lastStatus']) || 'idle',
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  };
}
