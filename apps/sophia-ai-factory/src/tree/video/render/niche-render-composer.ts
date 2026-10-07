/**
 * Niche Video Render Composer
 *
 * Merges storyboard scenes, synthesized voiceovers, visual assets, and regulatory
 * compliance overlays into a single executable rendering manifest.
 * Layer: tree (domain reusable logic)
 * @module tree/video/render/niche-render-composer
 */

import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { generateOverlayFfmpegFilter } from '@/tree/video/blueprints/crypto-compliance-overlay';
import type { SynthesizedCampaignScript } from './niche-script-synthesizer';
import type { SceneVisualAsset } from './niche-scene-visual-generator';
import type { NicheVoiceoverResult } from './niche-voiceover-generator';

export interface NicheRenderManifest {
  manifestId: string;
  planId: string;
  title: string;
  resolution: { width: 1080; height: 1920 };
  fps: number;
  totalDurationSec: number;
  scenes: SceneVisualAsset[];
  audio: {
    voiceoverUrl?: string;
    backgroundMusicDuckingDb: number;
  };
  ffmpegFilter: string;
  trackedUrl: string;
  caption: string;
  generatedAt: string;
}

export function composeNicheRenderManifest(params: {
  plan: NicheVideoCampaignPlan;
  script: SynthesizedCampaignScript;
  visuals: SceneVisualAsset[];
  voiceover?: NicheVoiceoverResult;
}): NicheRenderManifest {
  const { plan, script, visuals, voiceover } = params;

  let ffmpegFilter = '';
  let duckingDb = -12;

  if (plan.overlaySpec) {
    ffmpegFilter = generateOverlayFfmpegFilter(plan.overlaySpec);
    duckingDb = plan.overlaySpec.audioDuckingDb;
  } else {
    // Standard affiliate disclosure filter for SaaS
    const disclosureText = 'Disclosure: Partner Link. We may earn a commission.'.replace(/'/g, "\\'");
    ffmpegFilter = `drawtext=text='${disclosureText}':fontcolor=white@0.85:fontsize=22:x=(w-text_w)/2:y=h*0.94:box=1:boxcolor=black@0.6:boxborderw=6`;
  }

  return {
    manifestId: `mnf_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    planId: plan.planId,
    title: plan.productName || plan.blueprint.name,
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    totalDurationSec: script.totalDurationSec,
    scenes: visuals,
    audio: {
      voiceoverUrl: voiceover?.audioUrl,
      backgroundMusicDuckingDb: duckingDb,
    },
    ffmpegFilter,
    trackedUrl: plan.trackedUrl,
    caption: plan.caption,
    generatedAt: new Date().toISOString(),
  };
}
