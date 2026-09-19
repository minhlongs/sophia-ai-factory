/**
 * Creative Learning Loop Domain Types — Phase 5: Auto-Creative Playbook
 * Layer: tree (pure domain engine — only imports from @/seed)
 */

import type {
  HookStyle,
  VoiceProfile,
  DurationPattern,
  CampaignBlueprint,
  RecurringCampaignSchedule,
  CreativeEffectivenessScore,
  CreativeMetricsInput,
  CASUpdateResult,
  PatternScoreUpdates,
  PlaybookPattern,
  PlaybookRule,
} from '@/seed/types/playbook-pattern';

import type {
  CreativeMissionStatus,
  Mission,
} from '@/seed/types/creative-domain';

export type {
  HookStyle,
  VoiceProfile,
  DurationPattern,
  CampaignBlueprint,
  RecurringCampaignSchedule,
  CreativeEffectivenessScore,
  CreativeMetricsInput,
  CASUpdateResult,
  PatternScoreUpdates,
  PlaybookPattern,
  PlaybookRule,
  CreativeMissionStatus,
  Mission,
};

/** Normalized extracted variables from a completed creative mission */
export interface ExtractedCreativeVariables {
  missionId: string;
  workspaceId: string;
  hookStyle: HookStyle;
  voiceProfile: VoiceProfile;
  voiceId?: string;
  durationPattern: DurationPattern;
  actualDurationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  sceneCount: number;
  channels: string[];
  title?: string;
}

/** Script scene structure representation for hook extraction */
export interface ScriptSceneData {
  index?: number;
  prompt?: string;
  narration?: string;
  durationSeconds?: number;
}

/** Content asset representation in learning loop */
export interface LearningLoopAssetInput {
  id: string;
  projectId: string; // missionId
  workspaceId: string;
  type: string; // 'script' | 'audio' | 'video' | 'image' | string
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}
