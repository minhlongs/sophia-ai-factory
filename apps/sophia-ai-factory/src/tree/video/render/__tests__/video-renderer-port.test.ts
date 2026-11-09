/**
 * Unit tests for BP-03: SophiaVideoTimelineSchema, VideoRendererPort, and Segment Cache.
 * @module tree/video/render/__tests__/video-renderer-port.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  SophiaVideoTimelineSchema,
  computeSegmentCacheKey,
  getTimelineMetrics,
  type SophiaVideoTimeline,
} from '@/seed/types/video-timeline-schema';
import {
  HyperFramesRenderer,
  RemotionRenderer,
  createInMemorySegmentCache,
  createVideoRenderer,
} from '../video-renderer-port';

function buildSampleTimeline(): SophiaVideoTimeline {
  return SophiaVideoTimelineSchema.parse({
    timelineId: 'tl_bp03_001',
    tenantId: 'org_alpha',
    title: 'AI Factory Launch Short',
    width: 1080,
    height: 1920,
    fps: 30,
    codec: 'h264',
    voiceId: 'af_heart',
    scenes: [
      {
        sceneId: 'scene_hook',
        kind: 'GENERATIVE_HOOK_BROLL',
        headline: 'Stop wasting 10 hours editing!',
        startFrame: 0,
        durationInFrames: 90,
      },
      {
        sceneId: 'scene_data',
        kind: 'DETERMINISTIC_DATA_CARD',
        headline: '3.4x Higher Conversion Rate',
        startFrame: 90,
        durationInFrames: 120,
      },
      {
        sceneId: 'scene_cta',
        kind: 'COMPLIANCE_END_CARD',
        headline: 'Try Sophia AI Factory Today',
        startFrame: 210,
        durationInFrames: 90,
      },
    ],
    captions: [
      { id: 'c1', text: 'Stop wasting 10 hours', startSec: 0, endSec: 2.5 },
      { id: 'c2', text: '3.4x conversion boost', startSec: 3.2, endSec: 6.5 },
    ],
  });
}

describe('BP-03 SophiaVideoTimelineSchema & VideoRendererPort', () => {
  it('validates 1080x1920 @ 30fps timeline schema and computes totalFrames & durationSec', () => {
    const timeline = buildSampleTimeline();
    const metrics = getTimelineMetrics(timeline);
    expect(timeline.width).toBe(1080);
    expect(timeline.height).toBe(1920);
    expect(timeline.fps).toBe(30);
    expect(metrics.totalFrames).toBe(300);
    expect(metrics.durationSec).toBe(10);
  });

  it('produces identical SHA-256 segment cache keys for unchanged scenes and distinct keys when headline changes', async () => {
    const timeline = buildSampleTimeline();
    const k1 = await computeSegmentCacheKey(timeline.scenes[0], timeline.fps, timeline.captions);
    const k2 = await computeSegmentCacheKey(
      { ...timeline.scenes[0], headline: '  Stop wasting 10 hours editing!  ' },
      timeline.fps,
      timeline.captions,
    );
    const kChanged = await computeSegmentCacheKey(
      { ...timeline.scenes[0], headline: 'Updated Hook Headline' },
      timeline.fps,
      timeline.captions,
    );

    expect(k1).toMatch(/^[a-f0-9]{64}$/);
    expect(k1).toBe(k2);
    expect(k1).not.toBe(kChanged);
  });

  it('re-renders only the modified scene when segment cache is enabled across HyperFrames and Remotion', async () => {
    const cacheStore = createInMemorySegmentCache();
    const renderSceneSpy = vi.fn(async (scene, cacheKey, engine) => ({
      segmentUrl: `https://r2.sophia.local/${engine}/${scene.sceneId}-${cacheKey.slice(0, 8)}.mp4`,
      renderTimeMs: 42,
    }));

    const renderer = new HyperFramesRenderer({
      cacheStore,
      renderSceneSegment: renderSceneSpy,
    });

    const timeline = buildSampleTimeline();
    const firstRender = await renderer.renderTimeline(timeline);

    expect(firstRender.engine).toBe('hyperframes');
    expect(firstRender.licenseType).toBe('Apache-2.0');
    expect(firstRender.cacheHitRatio).toBe(0);
    expect(renderSceneSpy).toHaveBeenCalledTimes(3);

    // Modify only scene_data (1 out of 3 scenes)
    const editedTimeline: SophiaVideoTimeline = {
      ...timeline,
      scenes: timeline.scenes.map((s) =>
        s.sceneId === 'scene_data' ? { ...s, headline: '4.1x Verified ROI' } : s,
      ),
    };

    const secondRender = await renderer.renderTimeline(editedTimeline);
    expect(secondRender.segments[0].cacheHit).toBe(true);
    expect(secondRender.segments[1].cacheHit).toBe(false);
    expect(secondRender.segments[2].cacheHit).toBe(true);
    expect(secondRender.cacheHitRatio).toBe(0.67);
    expect(renderSceneSpy).toHaveBeenCalledTimes(4);

    // Verify RemotionRenderer swaps cleanly behind createVideoRenderer
    const remotion = createVideoRenderer('remotion', { cacheStore });
    expect(remotion).toBeInstanceOf(RemotionRenderer);
    const remotionRender = await remotion.renderTimeline(editedTimeline);
    expect(remotionRender.engine).toBe('remotion');
    expect(remotionRender.licenseType).toBe('Remotion-Free-Tier');
    expect(remotionRender.cacheHitRatio).toBe(1);
  });
});
