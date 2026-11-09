/**
 * Converts a NicheVideoCampaignPlan into a standardized SophiaVideoTimeline (1080x1920 @ 30fps)
 * so Niche Studio can render the zero-cost DOM Browser Preview and trigger MP4 renders.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/video/render/niche-plan-to-timeline
 */

import type {
  SophiaVideoTimeline,
  VideoCaptionCue,
  VideoTimelineScene,
} from '@/seed/types/video-timeline-schema';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';

const SCENE_BG_PALETTE = ['#0F172A', '#1E1B4B', '#172554', '#022C22'] as const;

const SCENE_KINDS: readonly VideoTimelineScene['kind'][] = [
  'GENERATIVE_HOOK_BROLL',
  'DETERMINISTIC_DATA_CARD',
  'AVATAR_AUTHORITY_SEGMENT',
  'COMPLIANCE_END_CARD',
];

export function nichePlanToVideoTimeline(
  plan: NicheVideoCampaignPlan,
  tenantId = 'workspace_default',
): SophiaVideoTimeline {
  const fps = 30 as const;
  let currentFrame = 0;
  const scenes: VideoTimelineScene[] = [];
  const captions: VideoCaptionCue[] = [];

  const sourceScenes = plan.storyboard.scenes;
  sourceScenes.forEach((scene, idx) => {
    const durationSec = Math.max(1, Math.round((scene.durationMs || 5000) / 1000));
    const durationInFrames = Math.round(durationSec * fps);
    const startSec = currentFrame / fps;
    const endSec = (currentFrame + durationInFrames) / fps;
    const kind =
      idx === 0
        ? 'GENERATIVE_HOOK_BROLL'
        : idx === sourceScenes.length - 1
          ? 'COMPLIANCE_END_CARD'
          : SCENE_KINDS[idx % SCENE_KINDS.length];

    const headline = (scene.overlayText || scene.name || plan.productName).slice(0, 200);
    const subheadline = scene.narrationText ? scene.narrationText.slice(0, 300) : undefined;
    const sceneId = `scene_${scene.sceneIndex + 1}`;

    scenes.push({
      sceneId,
      kind,
      headline: headline.length > 0 ? headline : plan.productName,
      subheadline,
      startFrame: currentFrame,
      durationInFrames,
      backgroundHex: SCENE_BG_PALETTE[idx % SCENE_BG_PALETTE.length],
    });

    const cueText = (scene.narrationText || scene.overlayText || scene.name).trim();
    if (cueText.length > 0) {
      captions.push({
        id: `cap_${sceneId}`,
        text: cueText,
        startSec,
        endSec,
      });
    }

    currentFrame += durationInFrames;
  });

  if (scenes.length === 0) {
    scenes.push({
      sceneId: 'scene_default_1',
      kind: 'GENERATIVE_HOOK_BROLL',
      headline: plan.productName.slice(0, 200) || 'Sophia Campaign',
      startFrame: 0,
      durationInFrames: 150,
      backgroundHex: '#0F172A',
    });
  }

  return {
    timelineId: `tl_${plan.planId}`,
    tenantId,
    title: (plan.productName || plan.blueprint.name).slice(0, 160),
    width: 1080,
    height: 1920,
    fps,
    codec: 'h264',
    voiceId: plan.locale === 'vi' ? 'vi_female_1' : 'af_heart',
    scenes,
    captions,
    branding: {
      primaryColorHex: '#D97706',
      accentColorHex: '#4F46E5',
      watermarkText: plan.overlaySpec?.bottomThirdBanner.text.slice(0, 80),
    },
  };
}
