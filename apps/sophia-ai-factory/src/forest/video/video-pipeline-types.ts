/**
 * Autonomous Video Factory Pipeline Types.
 * Orchestration contracts connecting Blueprints, Hooks, B-Roll, Audio, Subtitles & Syndication.
 */

import type { AudioMixSpec } from '@/tree/video/audio/audio-types';
import type { BRollCue } from '@/tree/video/broll/broll-types';
import type { ComplianceOverlaySpec } from '@/tree/video/compliance/compliance-types';
import type { SubtitleTrackSpec } from '@/tree/video/subtitles/subtitle-types';
import type { NicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-types';

export type PipelineNiche = 'saas_global' | 'crypto_global';

export interface AutonomousPipelineInput {
  campaignId: string;
  niche: PipelineNiche;
  productName: string;
  productUrl: string;
  productDescription: string;
  targetDurationSeconds?: number;
  affiliateBaseUrl: string;
  targetPlatforms?: ('youtube_shorts' | 'tiktok' | 'instagram_reels')[];
}

export interface VideoRenderManifest {
  manifestId: string;
  campaignId: string;
  niche: PipelineNiche;
  title: string;
  durationSeconds: number;
  dimensions: { width: number; height: number }; // 1080x1920 default (9:16)
  hookVariantAngle: string;
  scriptText: string;
  brollCues: BRollCue[];
  audioMix: AudioMixSpec;
  subtitles: SubtitleTrackSpec;
  complianceOverlay: ComplianceOverlaySpec;
  syndication: NicheSyndicationPackage;
  generatedAt: string;
}

export interface PipelineExecutionSummary {
  success: boolean;
  campaignId: string;
  manifest: VideoRenderManifest;
  hookVariantsGeneratedCount: number;
  totalBrollCuts: number;
  totalSfxCues: number;
  estimatedRenderTimeSeconds: number;
}
