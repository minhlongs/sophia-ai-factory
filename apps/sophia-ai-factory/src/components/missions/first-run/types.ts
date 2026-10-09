/**
 * First-Run Wizard Types & Configuration
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/types
 */

import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import type { MissionStageId } from '../mission-progress-bar';

export interface FirstRunWizardProps {
  workspaceId: string;
  userId?: string;
  locale?: 'vi' | 'en';
  initialBlueprint?: MarketplaceBlueprintItem | null;
  initialMcuBalance?: number;
  userTier?: string;
}

export const POLL_INTERVAL_MS = 1500;
export const MAX_POLL_TIMEOUT_MS = 180_000; // 3 minutes max

export const STAGE_TO_KEY: Record<MissionStageId, string> = {
  SCRIPT_GENERATION: 'script_generation',
  VOICE_SYNTHESIS: 'voice_synthesis',
  VISUAL_GENERATION: 'visual_generation',
  VIDEO_COMPOSITING: 'video_compositing',
  READY_FOR_REVIEW: 'ready_for_review',
};

export type WizardStatus = 'idle' | 'running' | 'completed' | 'failed';
