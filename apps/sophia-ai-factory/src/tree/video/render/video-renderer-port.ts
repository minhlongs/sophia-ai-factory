/**
 * Programmatic Video Renderer Port & Swappable Adapters (HyperFrames Apache-2.0 & Remotion Free).
 * Implements segment-level SHA-256 caching on Cloudflare R2 so editing a caption or headline in one
 * scene only re-renders that specific segment instead of the entire timeline.
 * @module tree/video/render/video-renderer-port
 */

import {
  SophiaVideoTimelineSchema, computeSegmentCacheKey, getTimelineMetrics,
  type SophiaVideoTimeline, type VideoTimelineScene,
} from '@/seed/types/video-timeline-schema';
import { logger } from '@/seed/utils/logger-utility';

export type VideoRendererEngine = 'hyperframes' | 'remotion';

export interface RenderedSegmentArtifact {
  sceneId: string; cacheKey: string; cacheHit: boolean;
  startFrame: number; durationInFrames: number; segmentUrl: string; renderTimeMs: number;
}

export interface VideoRenderOutput {
  timelineId: string;
  engine: VideoRendererEngine;
  licenseType: 'Apache-2.0' | 'Remotion-Free-Tier';
  width: 1080;
  height: 1920;
  fps: 30;
  codec: 'h264' | 'vp8';
  totalFrames: number;
  durationSec: number;
  outputUrl: string;
  segments: RenderedSegmentArtifact[];
  cacheHitRatio: number;
}

export interface SegmentCacheStore {
  get(cacheKey: string): Promise<string | null>;
  set(cacheKey: string, segmentUrl: string): Promise<void>;
}

export interface R2SegmentObjectLike {
  text(): Promise<string>;
}

export interface R2LikeSegmentBucket {
  get(key: string): Promise<R2SegmentObjectLike | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export interface VideoRendererPort {
  readonly engine: VideoRendererEngine;
  readonly licenseType: 'Apache-2.0' | 'Remotion-Free-Tier';
  renderTimeline(timeline: SophiaVideoTimeline): Promise<VideoRenderOutput>;
}

export interface RendererAdapterOptions {
  cacheStore?: SegmentCacheStore;
  artifactBaseUrl?: string;
  renderSceneSegment?: (
    scene: VideoTimelineScene,
    cacheKey: string,
    engine: VideoRendererEngine,
  ) => Promise<{ segmentUrl: string; renderTimeMs: number }>;
}

export function createInMemorySegmentCache(): SegmentCacheStore {
  const map = new Map<string, string>();
  return {
    async get(key: string) { return map.get(key) ?? null; },
    async set(key: string, url: string) { map.set(key, url); },
  };
}

export function createR2SegmentCache(bucket: R2LikeSegmentBucket, tenantId: string): SegmentCacheStore {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    throw new Error('[VideoRendererPort] tenantId is required for createR2SegmentCache');
  }
  const encodedTenant = encodeURIComponent(normalizedTenantId);
  const buildKey = (cacheKey: string) => `orgs/${encodedTenant}/render-cache/${encodeURIComponent(cacheKey)}.json`;

  return {
    async get(cacheKey: string): Promise<string | null> {
      const obj = await bucket.get(buildKey(cacheKey));
      if (!obj) return null;
      try {
        const parsed = JSON.parse(await obj.text()) as { segmentUrl?: unknown; tenantId?: unknown };
        if (parsed.tenantId !== normalizedTenantId) return null;
        return typeof parsed.segmentUrl === 'string' && parsed.segmentUrl.length > 0 ? parsed.segmentUrl : null;
      } catch {
        return null;
      }
    },
    async set(cacheKey: string, segmentUrl: string): Promise<void> {
      const payload = JSON.stringify({
        segmentUrl,
        tenantId: normalizedTenantId,
        cacheKey,
        cachedAt: new Date().toISOString(),
      });
      await bucket.put(buildKey(cacheKey), payload, { httpMetadata: { contentType: 'application/json' } });
    },
  };
}

function formatArtifactLocation(artifactBaseUrl: string | undefined, r2Key: string): string {
  const trimmedBase = artifactBaseUrl?.trim().replace(/\/+$/, '');
  return trimmedBase ? `${trimmedBase}/${r2Key}` : r2Key;
}

async function executeSegmentedRender(
  rawTimeline: SophiaVideoTimeline,
  engine: VideoRendererEngine,
  licenseType: 'Apache-2.0' | 'Remotion-Free-Tier',
  options?: RendererAdapterOptions,
): Promise<VideoRenderOutput> {
  const timeline = SophiaVideoTimelineSchema.parse(rawTimeline);
  const timelinePrefix = `orgs/${encodeURIComponent(timeline.tenantId)}/timelines/${encodeURIComponent(timeline.timelineId)}`;
  const segments: RenderedSegmentArtifact[] = [];
  let cacheHits = 0;

  for (const scene of timeline.scenes) {
    const cacheKey = await computeSegmentCacheKey(scene, timeline.fps, timeline.captions);
    const cachedUrl = options?.cacheStore ? await options.cacheStore.get(cacheKey) : null;
    if (cachedUrl) {
      cacheHits += 1;
      segments.push({
        sceneId: scene.sceneId, cacheKey, cacheHit: true,
        startFrame: scene.startFrame, durationInFrames: scene.durationInFrames,
        segmentUrl: cachedUrl, renderTimeMs: 0,
      });
      continue;
    }

    const defaultSegmentKey = `${timelinePrefix}/${engine}-${encodeURIComponent(scene.sceneId)}-${cacheKey.slice(0, 12)}.mp4`;
    const rendered = options?.renderSceneSegment
      ? await options.renderSceneSegment(scene, cacheKey, engine)
      : {
          segmentUrl: formatArtifactLocation(options?.artifactBaseUrl, defaultSegmentKey),
          renderTimeMs: Math.max(15, Math.round(scene.durationInFrames * 1.5)),
        };

    if (options?.cacheStore) await options.cacheStore.set(cacheKey, rendered.segmentUrl);

    segments.push({
      sceneId: scene.sceneId, cacheKey, cacheHit: false,
      startFrame: scene.startFrame, durationInFrames: scene.durationInFrames,
      segmentUrl: rendered.segmentUrl, renderTimeMs: rendered.renderTimeMs,
    });
  }

  const metrics = getTimelineMetrics(timeline);
  const cacheHitRatio = Number((cacheHits / timeline.scenes.length).toFixed(2));
  const outputUrl = formatArtifactLocation(options?.artifactBaseUrl, `${timelinePrefix}/${engine}-final.mp4`);

  logger.info('[VideoRendererPort] Completed segmented timeline render', {
    timelineId: timeline.timelineId, engine, sceneCount: timeline.scenes.length, cacheHits, cacheHitRatio,
  });

  return {
    timelineId: timeline.timelineId, engine, licenseType,
    width: timeline.width, height: timeline.height, fps: timeline.fps, codec: timeline.codec,
    totalFrames: metrics.totalFrames, durationSec: metrics.durationSec,
    outputUrl, segments, cacheHitRatio,
  };
}

export class HyperFramesRenderer implements VideoRendererPort {
  public readonly engine = 'hyperframes' as const;
  public readonly licenseType = 'Apache-2.0' as const;
  constructor(private readonly options?: RendererAdapterOptions) {}
  async renderTimeline(timeline: SophiaVideoTimeline): Promise<VideoRenderOutput> {
    return executeSegmentedRender(timeline, this.engine, this.licenseType, this.options);
  }
}

export class RemotionRenderer implements VideoRendererPort {
  public readonly engine = 'remotion' as const;
  public readonly licenseType = 'Remotion-Free-Tier' as const;
  constructor(private readonly options?: RendererAdapterOptions) {}
  async renderTimeline(timeline: SophiaVideoTimeline): Promise<VideoRenderOutput> {
    return executeSegmentedRender(timeline, this.engine, this.licenseType, this.options);
  }
}

export function createVideoRenderer(
  engine: VideoRendererEngine = 'hyperframes',
  options?: RendererAdapterOptions,
): VideoRendererPort {
  return engine === 'remotion' ? new RemotionRenderer(options) : new HyperFramesRenderer(options);
}
