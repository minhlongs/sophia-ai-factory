/**
 * Standardized Sophia Video Timeline Schema & deterministic segment cache hashing.
 * Decouples timeline data contracts from specific programmatic renderers
 * (HyperFrames Apache-2.0 or Remotion Free tier).
 *
 * Layer: seed (foundational primitive)
 * @module seed/types/video-timeline-schema
 */

import { z } from 'zod';

export const VideoCaptionCueSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  startSec: z.number().min(0),
  endSec: z.number().positive(),
  highlightWord: z.string().optional(),
});

export type VideoCaptionCue = z.infer<typeof VideoCaptionCueSchema>;

export const VideoTimelineSceneSchema = z.object({
  sceneId: z.string().min(1),
  kind: z.enum([
    'GENERATIVE_HOOK_BROLL',
    'DETERMINISTIC_DATA_CARD',
    'AVATAR_AUTHORITY_SEGMENT',
    'COMPLIANCE_END_CARD',
  ]),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(300).optional(),
  startFrame: z.number().int().min(0),
  durationInFrames: z.number().int().positive(),
  assetUrl: z.string().url().optional(),
  backgroundHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0F172A'),
});

export type VideoTimelineScene = z.infer<typeof VideoTimelineSceneSchema>;

export const SophiaVideoTimelineSchema = z.object({
  timelineId: z.string().min(1),
  tenantId: z.string().min(1),
  title: z.string().min(1).max(160),
  width: z.literal(1080).default(1080),
  height: z.literal(1920).default(1920),
  fps: z.literal(30).default(30),
  codec: z.enum(['h264', 'vp8']).default('h264'),
  audioTrackUrl: z.string().url().optional(),
  voiceId: z.string().min(1).default('af_heart'),
  scenes: z.array(VideoTimelineSceneSchema).min(1).max(24),
  captions: z.array(VideoCaptionCueSchema).default([]),
  branding: z
    .object({
      primaryColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#D97706'),
      accentColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4F46E5'),
      watermarkText: z.string().max(80).optional(),
    })
    .default({ primaryColorHex: '#D97706', accentColorHex: '#4F46E5' }),
});

export type SophiaVideoTimeline = z.infer<typeof SophiaVideoTimelineSchema>;

/**
 * Computes a deterministic SHA-256 hex digest for a single scene + overlapping captions
 * so unchanged timeline segments can be served from cache during re-renders.
 */
export async function computeSegmentCacheKey(
  scene: VideoTimelineScene,
  fps: number,
  captions: readonly VideoCaptionCue[],
): Promise<string> {
  const sceneStartSec = scene.startFrame / fps;
  const sceneEndSec = (scene.startFrame + scene.durationInFrames) / fps;
  const activeCaptions = captions
    .filter((c) => c.endSec > sceneStartSec && c.startSec < sceneEndSec)
    .map((c) => ({
      text: c.text.trim(),
      startSec: Number(c.startSec.toFixed(3)),
      endSec: Number(c.endSec.toFixed(3)),
      highlightWord: c.highlightWord?.trim() ?? '',
    }));

  const payload = JSON.stringify({
    sceneId: scene.sceneId,
    kind: scene.kind,
    headline: scene.headline.trim(),
    subheadline: scene.subheadline?.trim() ?? '',
    startFrame: scene.startFrame,
    durationInFrames: scene.durationInFrames,
    assetUrl: scene.assetUrl ?? '',
    backgroundHex: scene.backgroundHex.toUpperCase(),
    fps,
    captions: activeCaptions,
  });

  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculates total frame count and duration in seconds for a validated timeline.
 */
export function getTimelineMetrics(timeline: SophiaVideoTimeline): {
  totalFrames: number;
  durationSec: number;
} {
  const totalFrames = timeline.scenes.reduce(
    (maxEnd, s) => Math.max(maxEnd, s.startFrame + s.durationInFrames),
    0,
  );
  return {
    totalFrames,
    durationSec: Number((totalFrames / timeline.fps).toFixed(2)),
  };
}
