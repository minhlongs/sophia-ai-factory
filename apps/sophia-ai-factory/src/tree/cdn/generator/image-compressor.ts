/**
 * Image compression estimation, MIME types, and BlurHash algorithms.
 *
 * @module tree/cdn/generator/image-compressor
 */

import type { ThumbnailFormat } from '@/tree/cdn/types';

export {
  BLURHASH_CHARSET,
  encodeBase83,
  decodeBase83,
  isValidBlurHash,
  generateBlurHash,
} from './blurhash-codec';

export const FORMAT_MIME_TYPES: Record<ThumbnailFormat, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
};

/**
 * Calculates estimated compressed byte size based on dimensions, format, and quality.
 * AVIF yields ~38% smaller payloads than WebP, which is ~30% smaller than JPEG.
 */
export function calculateEstimatedSizeBytes(
  width: number,
  height: number,
  format: ThumbnailFormat,
  quality?: number,
): number {
  const totalPixels = width * height;

  let bpp = 0.08;
  let targetQuality = quality;

  if (format === 'avif') {
    bpp = 0.05;
    targetQuality = quality ?? 75;
  } else if (format === 'webp') {
    bpp = 0.08;
    targetQuality = quality ?? 82;
  } else if (format === 'jpeg') {
    bpp = 0.12;
    targetQuality = quality ?? 85;
  }

  const qualityFactor = (targetQuality ?? 80) / 80;
  const estimatedBytes = Math.floor(totalPixels * bpp * qualityFactor);

  return Math.max(1024, estimatedBytes);
}
