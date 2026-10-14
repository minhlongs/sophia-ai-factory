/**
 * Playbook Blueprint & Recurring Campaign Types
 */

import type { HookStyle, VoiceProfile } from './playbook-pattern-rules';

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
