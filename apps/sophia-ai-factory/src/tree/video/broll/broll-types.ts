/**
 * B-Roll visual asset types for SaaS & Crypto video synthesis.
 * Strict TypeScript types for asset matching and timeline cues.
 */

export type BRollNiche = 'saas_global' | 'crypto_global' | 'general_tech';

export type BRollCategory =
  | 'saas_ui_walkthrough'
  | 'saas_mockup'
  | 'saas_terminal'
  | 'crypto_candlestick'
  | 'crypto_onchain_flow'
  | 'crypto_tokenomics'
  | 'abstract_tech'
  | 'profit_visual'
  | 'security_shield';

export type BRollMotionStyle =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_right'
  | 'pan_left'
  | 'parallax'
  | 'pulse'
  | 'static';

export interface BRollAsset {
  id: string;
  name: string;
  niche: BRollNiche;
  category: BRollCategory;
  url: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  tags: string[];
  recommendedMotion: BRollMotionStyle;
  isLoopable: boolean;
}

export interface BRollCue {
  assetId: string;
  category: BRollCategory;
  assetUrl: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  motionStyle: BRollMotionStyle;
  promptFallback?: string;
  overlayOpacity: number;
}

export interface ScriptWordTimestamp {
  word: string;
  startTime: number;
  endTime: number;
}

export interface BRollMatchRequest {
  niche: BRollNiche;
  totalDurationSeconds: number;
  scriptText: string;
  wordTimestamps?: ScriptWordTimestamp[];
  targetCutIntervalSeconds?: number;
}

export interface BRollMatchResult {
  niche: BRollNiche;
  cues: BRollCue[];
  totalCues: number;
  averageCutDuration: number;
  coveragePercentage: number;
}
