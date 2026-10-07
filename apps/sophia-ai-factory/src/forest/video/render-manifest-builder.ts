/**
 * Video Render Manifest Builder.
 * Combines all synthesized visual, audio, and compliance layers into a single Remotion-ready payload.
 */

import type { AudioMixSpec } from '@/tree/video/audio/audio-types';
import type { BRollCue } from '@/tree/video/broll/broll-types';
import type { ComplianceOverlaySpec } from '@/tree/video/compliance/compliance-types';
import type { SubtitleTrackSpec } from '@/tree/video/subtitles/subtitle-types';
import type { NicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-types';
import type {
  PipelineNiche,
  VideoRenderManifest,
} from './video-pipeline-types';

export interface AssembleManifestParams {
  campaignId: string;
  niche: PipelineNiche;
  title: string;
  durationSeconds: number;
  hookVariantAngle: string;
  scriptText: string;
  brollCues: BRollCue[];
  audioMix: AudioMixSpec;
  subtitles: SubtitleTrackSpec;
  complianceOverlay: ComplianceOverlaySpec;
  syndication: NicheSyndicationPackage;
}

export function assembleRenderManifest(
  params: AssembleManifestParams
): VideoRenderManifest {
  const manifestId = `manifest-${params.campaignId}-${Date.now().toString(36)}`;

  return {
    manifestId,
    campaignId: params.campaignId,
    niche: params.niche,
    title: params.title,
    durationSeconds: params.durationSeconds,
    dimensions: { width: 1080, height: 1920 }, // Vertical 9:16 standard
    hookVariantAngle: params.hookVariantAngle,
    scriptText: params.scriptText,
    brollCues: params.brollCues,
    audioMix: params.audioMix,
    subtitles: params.subtitles,
    complianceOverlay: params.complianceOverlay,
    syndication: params.syndication,
    generatedAt: new Date().toISOString(),
  };
}
