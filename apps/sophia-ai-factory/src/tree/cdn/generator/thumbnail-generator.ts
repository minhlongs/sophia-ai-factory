/**
 * Thumbnail variant specifications generator and D1 database repository.
 *
 * @module tree/cdn/generator/thumbnail-generator
 */

import type {
  AspectRatio,
  ThumbnailFormat,
  AssetThumbnailVariant,
  GenerateVariantsInput,
} from '@/tree/cdn/types';
import { ASPECT_RATIOS } from '@/tree/cdn/types';
import { getDimensionsForAspectRatio } from './canvas-renderer';
import { generateBlurHash, calculateEstimatedSizeBytes } from './image-compressor';

export {
  saveThumbnailVariants,
  getThumbnailVariantsByAsset,
} from './thumbnail-variant-repository';

/**
 * Generates thumbnail variant records for an asset across aspect ratios and formats.
 */
export function generateThumbnailVariantSpecs(
  input: GenerateVariantsInput,
): AssetThumbnailVariant[] {
  const ratios = input.aspectRatios ?? ASPECT_RATIOS;
  const formats = input.formats ?? ['webp', 'avif'];
  const baseUrl = input.cdnBaseUrl ?? 'https://cdn.sophia.agencyos.network';
  const now = Date.now();

  const variants: AssetThumbnailVariant[] = [];

  for (const ratio of ratios) {
    const dims = getDimensionsForAspectRatio(ratio, 'high');
    const blurHash = input.customBlurHash ?? generateBlurHash(input.assetId, ratio);

    for (const fmt of formats) {
      const sizeBytes = calculateEstimatedSizeBytes(dims.width, dims.height, fmt);
      const ratioSlug = ratio.replace(':', 'x');
      const cdnUrl = `${baseUrl}/assets/${input.tenantId}/${input.assetId}/thumb_${ratioSlug}_${dims.width}x${dims.height}.${fmt}`;

      variants.push({
        id: `th_${crypto.randomUUID()}`,
        assetId: input.assetId,
        tenantId: input.tenantId,
        aspectRatio: ratio,
        format: fmt,
        width: dims.width,
        height: dims.height,
        sizeBytes,
        cdnUrl,
        blurHash,
        createdAt: now,
      });
    }
  }

  return variants;
}

/**
 * Finds the optimal variant matching preferred aspect ratio and format.
 */
export function selectOptimalVariant(
  variants: AssetThumbnailVariant[],
  preferredRatio: AspectRatio = '9:16',
  preferredFormat: ThumbnailFormat = 'webp',
): AssetThumbnailVariant | null {
  if (variants.length === 0) return null;

  // 1. Exact match on ratio & format
  const exact = variants.find(
    (v) => v.aspectRatio === preferredRatio && v.format === preferredFormat,
  );
  if (exact) return exact;

  // 2. Match ratio with any format (prefer AVIF -> WebP -> JPEG)
  const ratioMatches = variants.filter((v) => v.aspectRatio === preferredRatio);
  if (ratioMatches.length > 0) {
    const avif = ratioMatches.find((v) => v.format === 'avif');
    if (avif) return avif;
    const webp = ratioMatches.find((v) => v.format === 'webp');
    if (webp) return webp;
    return ratioMatches[0]!;
  }

  // 3. Fallback to first available
  return variants[0] ?? null;
}
