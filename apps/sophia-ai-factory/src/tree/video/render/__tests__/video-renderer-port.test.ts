/**
 * Unit tests for BP-03: SophiaVideoTimelineSchema, VideoRendererPort, and R2 Segment Cache.
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
  createR2SegmentCache,
  createVideoRenderer,
  type R2LikeSegmentBucket,
} from '../video-renderer-port';

function buildSampleTimeline(tenantId = 'org_alpha'): SophiaVideoTimeline {
  return SophiaVideoTimelineSchema.parse({
    timelineId: 'tl_bp03_001',
    tenantId,
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

function createFakeR2Bucket() {
  const objects = new Map<string, string>();
  const bucket: R2LikeSegmentBucket = {
    async get(key: string) {
      const value = objects.get(key);
      if (value === undefined) return null;
      return { text: async () => value };
    },
    async put(key: string, value: string) {
      objects.set(key, value);
    },
  };
  return { bucket, objects };
}

describe('BP-03 SophiaVideoTimelineSchema & VideoRendererPort', () => {
  it('validates 1080x1920 @ 30fps timeline schema and emits canonical orgs/{tenantId}/timelines R2 keys', async () => {
    const timeline = buildSampleTimeline();
    const metrics = getTimelineMetrics(timeline);
    expect(timeline.width).toBe(1080);
    expect(timeline.height).toBe(1920);
    expect(timeline.fps).toBe(30);
    expect(metrics.totalFrames).toBe(300);
    expect(metrics.durationSec).toBe(10);

    const defaultRender = await createVideoRenderer('hyperframes').renderTimeline(timeline);
    expect(defaultRender.outputUrl).toBe('orgs/org_alpha/timelines/tl_bp03_001/hyperframes-final.mp4');
    expect(defaultRender.segments[0].segmentUrl).toMatch(
      /^orgs\/org_alpha\/timelines\/tl_bp03_001\/hyperframes-scene_hook-[a-f0-9]{12}\.mp4$/,
    );
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
      segmentUrl: `orgs/org_alpha/timelines/tl_bp03_001/${engine}-${scene.sceneId}-${cacheKey.slice(0, 12)}.mp4`,
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

    const remotion = createVideoRenderer('remotion', { cacheStore });
    expect(remotion).toBeInstanceOf(RemotionRenderer);
    const remotionRender = await remotion.renderTimeline(editedTimeline);
    expect(remotionRender.engine).toBe('remotion');
    expect(remotionRender.licenseType).toBe('Remotion-Free-Tier');
    expect(remotionRender.outputUrl).toBe('orgs/org_alpha/timelines/tl_bp03_001/remotion-final.mp4');
    expect(remotionRender.cacheHitRatio).toBe(1);
  });

  it('stores segment cache entries in R2 under orgs/{tenantId}/render-cache/{cacheKey}.json with strict tenant isolation', async () => {
    const { bucket, objects } = createFakeR2Bucket();
    const cacheAlpha = createR2SegmentCache(bucket, 'org_alpha');
    const cacheBravo = createR2SegmentCache(bucket, 'org_bravo');

    await cacheAlpha.set('deadbeef1234', 'orgs/org_alpha/timelines/tl_1/hyperframes-scene_hook-deadbeef1234.mp4');

    expect(objects.has('orgs/org_alpha/render-cache/deadbeef1234.json')).toBe(true);
    await expect(cacheAlpha.get('deadbeef1234')).resolves.toBe(
      'orgs/org_alpha/timelines/tl_1/hyperframes-scene_hook-deadbeef1234.mp4',
    );
    await expect(cacheBravo.get('deadbeef1234')).resolves.toBeNull();

    const rendererAlpha = createVideoRenderer('hyperframes', { cacheStore: cacheAlpha });
    const rendererBravo = createVideoRenderer('hyperframes', { cacheStore: cacheBravo });
    const firstAlpha = await rendererAlpha.renderTimeline(buildSampleTimeline('org_alpha'));
    const secondAlpha = await rendererAlpha.renderTimeline(buildSampleTimeline('org_alpha'));
    const firstBravo = await rendererBravo.renderTimeline(buildSampleTimeline('org_bravo'));

    expect(firstAlpha.cacheHitRatio).toBe(0);
    expect(secondAlpha.cacheHitRatio).toBe(1);
    expect(firstBravo.cacheHitRatio).toBe(0);
    expect(firstBravo.outputUrl).toBe('orgs/org_bravo/timelines/tl_bp03_001/hyperframes-final.mp4');
  });
});
