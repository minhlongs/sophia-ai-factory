import type { AspectRatio, ThumbnailFormat } from '@/tree/cdn/types';

export interface ValidatedParams {
  assetId: string;
  preferredRatio: AspectRatio;
  preferredFormat: ThumbnailFormat;
  tenantId?: string;
  preferredRegion?: string;
}

export interface EdgeHints {
  country?: string;
  colo?: string;
  coordinates?: { lat: number; lon: number };
}
