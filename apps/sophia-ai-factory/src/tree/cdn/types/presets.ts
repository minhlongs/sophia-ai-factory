/**
 * Global Edge CDN Mesh — Enums & Presets
 *
 * Layer: tree/cdn/types
 */

export type AssetType = 'video' | 'thumbnail' | 'template' | 'preview' | 'hls_manifest';

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export type ThumbnailFormat = 'webp' | 'avif' | 'jpeg';

export type ThumbnailResolutionTier = 'high' | 'standard' | 'preview';

export interface DimensionSpec {
  width: number;
  height: number;
  tier: ThumbnailResolutionTier;
}

export const ASSET_TYPES: readonly AssetType[] = [
  'video',
  'thumbnail',
  'template',
  'preview',
  'hls_manifest',
] as const;

export const ASPECT_RATIOS: readonly AspectRatio[] = [
  '9:16',
  '16:9',
  '1:1',
  '4:5',
] as const;

export const THUMBNAIL_FORMATS: readonly ThumbnailFormat[] = [
  'webp',
  'avif',
  'jpeg',
] as const;

export const ASPECT_RATIO_PRESETS: Record<
  AspectRatio,
  Record<ThumbnailResolutionTier, { width: number; height: number }>
> = {
  '9:16': {
    high: { width: 1080, height: 1920 },
    standard: { width: 540, height: 960 },
    preview: { width: 270, height: 480 },
  },
  '16:9': {
    high: { width: 1920, height: 1080 },
    standard: { width: 1280, height: 720 },
    preview: { width: 640, height: 360 },
  },
  '1:1': {
    high: { width: 1080, height: 1080 },
    standard: { width: 600, height: 600 },
    preview: { width: 300, height: 300 },
  },
  '4:5': {
    high: { width: 1080, height: 1350 },
    standard: { width: 720, height: 900 },
    preview: { width: 360, height: 450 },
  },
};
