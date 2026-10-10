/**
 * Image compression estimation, MIME types, and BlurHash algorithms.
 *
 * @module tree/cdn/generator/image-compressor
 */

import type { AspectRatio, ThumbnailFormat } from '@/tree/cdn/types';
import type { SeedColor } from './types';

// RFC / BlurHash Base83 Alphabet
export const BLURHASH_CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

/**
 * Encodes an integer value into a Base83 string of specified length.
 */
export function encodeBase83(value: number, length: number): string {
  let result = '';
  const temp = Math.max(0, Math.floor(value));
  for (let i = 1; i <= length; i++) {
    const digit = Math.floor(temp / Math.pow(83, length - i)) % 83;
    result += BLURHASH_CHARSET[digit] ?? '0';
  }
  return result;
}

/**
 * Decodes a Base83 character sequence into an integer.
 */
export function decodeBase83(str: string): number {
  let val = 0;
  for (let i = 0; i < str.length; i++) {
    const index = BLURHASH_CHARSET.indexOf(str[i]!);
    if (index === -1) return 0;
    val = val * 83 + index;
  }
  return val;
}

/**
 * Validates whether a given string conforms to BlurHash format constraints.
 */
export function isValidBlurHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  if (hash.length < 6 || hash.length > 36) return false;

  for (let i = 0; i < hash.length; i++) {
    if (!BLURHASH_CHARSET.includes(hash[i]!)) {
      return false;
    }
  }

  const sizeFlag = decodeBase83(hash[0]!);
  const numCompX = (sizeFlag % 9) + 1;
  const numCompY = Math.floor(sizeFlag / 9) + 1;

  const expectedLength = 4 + 2 * numCompX * numCompY;
  return hash.length === expectedLength;
}

/**
 * Deterministically generates a valid BlurHash string for an asset and aspect ratio.
 */
export function generateBlurHash(
  assetId: string,
  aspectRatio: AspectRatio,
  seedColor?: SeedColor,
): string {
  const sizeFlagChar = 'L';

  let hashSeed = 0;
  const compositeKey = `${assetId}:${aspectRatio}`;
  for (let i = 0; i < compositeKey.length; i++) {
    hashSeed = (hashSeed * 31 + compositeKey.charCodeAt(i)) >>> 0;
  }

  const r = seedColor?.r ?? (hashSeed & 0xff);
  const g = seedColor?.g ?? ((hashSeed >>> 8) & 0xff);
  const b = seedColor?.b ?? ((hashSeed >>> 16) & 0xff);

  const maxAcValue = (hashSeed % 60) + 10;
  const maxAcChar = encodeBase83(maxAcValue, 1);

  const dcColorVal = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  const dcChars = encodeBase83(dcColorVal, 4);

  let acChars = '';
  let state = hashSeed;
  for (let i = 0; i < 11; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const acVal = state % (83 * 83);
    acChars += encodeBase83(acVal, 2);
  }

  return `${sizeFlagChar}${maxAcChar}${dcChars}${acChars}`;
}

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
