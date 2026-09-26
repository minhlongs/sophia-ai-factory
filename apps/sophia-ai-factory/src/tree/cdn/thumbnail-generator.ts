/**
 * Multi-Aspect-Ratio Thumbnail Generator & Format Metadata Engine
 *
 * Layer: tree/cdn (Thumbnail calculation, formatting, and DB synchronization)
 * Dependencies: @/seed and @/tree only
 *
 * Implements:
 * - Multi-aspect-ratio calculations: 9:16 (1080x1920), 16:9 (1920x1080), 1:1 (1080x1080), 4:5 (1080x1350)
 * - Compression and payload size estimation for WebP, AVIF, and JPEG
 * - BlurHash compact low-latency placeholder generator and validator
 * - D1 persistence and querying for thumbnail variants
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AspectRatio,
  ThumbnailFormat,
  ThumbnailResolutionTier,
  AssetThumbnailVariant,
  AssetThumbnailVariantRow,
  GenerateVariantsInput,
} from '@/tree/cdn/types';
import {
  ASPECT_RATIOS,
  THUMBNAIL_FORMATS,
  ASPECT_RATIO_PRESETS,
  mapRowToThumbnailVariant,
} from '@/tree/cdn/types';

// RFC / BlurHash Base83 Alphabet
export const BLURHASH_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

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
  // BlurHash is typically 20-36 chars long (minimum 6 for 1x1 DC only)
  if (hash.length < 6 || hash.length > 36) return false;

  for (let i = 0; i < hash.length; i++) {
    if (!BLURHASH_CHARSET.includes(hash[i]!)) {
      return false;
    }
  }

  // First character encodes numCompX and numCompY: sizeFlag = (numCompX - 1) + (numCompY - 1) * 9
  const sizeFlag = decodeBase83(hash[0]!);
  const numCompX = (sizeFlag % 9) + 1;
  const numCompY = Math.floor(sizeFlag / 9) + 1;

  const expectedLength = 4 + 2 * numCompX * numCompY;
  return hash.length === expectedLength;
}

/**
 * Deterministically generates a valid BlurHash string for an asset and aspect ratio.
 * Produces a standard 4x3 component BlurHash (sizeFlag = 3 + 2*9 = 21 -> 'L').
 */
export function generateBlurHash(
  assetId: string,
  aspectRatio: AspectRatio,
  seedColor?: { r: number; g: number; b: number }
): string {
  // 4x3 components -> sizeFlag = 21 -> char 'L'
  const sizeFlagChar = 'L';

  // Deterministic seed hashing from assetId + aspectRatio
  let hashSeed = 0;
  const compositeKey = `${assetId}:${aspectRatio}`;
  for (let i = 0; i < compositeKey.length; i++) {
    hashSeed = (hashSeed * 31 + compositeKey.charCodeAt(i)) >>> 0;
  }

  // Derive average DC color (R, G, B in 0..255)
  const r = seedColor?.r ?? (hashSeed & 0xff);
  const g = seedColor?.g ?? ((hashSeed >>> 8) & 0xff);
  const b = seedColor?.b ?? ((hashSeed >>> 16) & 0xff);

  // Encode max AC value (char 2)
  const maxAcValue = (hashSeed % 60) + 10;
  const maxAcChar = encodeBase83(maxAcValue, 1);

  // Encode average DC color into 4 Base83 characters
  const dcColorVal = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  const dcChars = encodeBase83(dcColorVal, 4);

  // Encode 4x3 - 1 = 11 AC components (2 Base83 characters each = 22 characters)
  let acChars = '';
  let state = hashSeed;
  for (let i = 0; i < 11; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const acVal = state % (83 * 83);
    acChars += encodeBase83(acVal, 2);
  }

  // Total length: 1 + 1 + 4 + 22 = 28 characters
  const blurHash = `${sizeFlagChar}${maxAcChar}${dcChars}${acChars}`;
  return blurHash;
}

/**
 * Aspect Ratio helper functions.
 */
export function isValidAspectRatio(ratio: string): ratio is AspectRatio {
  return (ASPECT_RATIOS as readonly string[]).includes(ratio);
}

export function isValidThumbnailFormat(fmt: string): fmt is ThumbnailFormat {
  return (THUMBNAIL_FORMATS as readonly string[]).includes(fmt);
}

export function parseAspectRatioNumeric(ratio: AspectRatio): number {
  switch (ratio) {
    case '9:16':
      return 9 / 16; // 0.5625
    case '16:9':
      return 16 / 9; // 1.7778
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5; // 0.8
  }
}

/**
 * Returns exact width & height for aspect ratio and tier.
 */
export function getDimensionsForAspectRatio(
  aspectRatio: AspectRatio,
  tier: ThumbnailResolutionTier = 'high'
): { width: number; height: number } {
  return ASPECT_RATIO_PRESETS[aspectRatio][tier];
}

/**
 * Calculates centered crop coordinates and scaling factors
 * to conform an arbitrary source image to a target aspect ratio.
 */
export function calculateCropAndScale(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio: AspectRatio
): {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  targetWidth: number;
  targetHeight: number;
  scaleFactor: number;
} {
  const targetDims = getDimensionsForAspectRatio(targetRatio, 'high');

  if (sourceWidth <= 0 || sourceHeight <= 0 || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) {
    // Default gracefully to target dimensions to prevent division by zero / Infinity scale factor
    return {
      cropX: 0,
      cropY: 0,
      cropWidth: targetDims.width,
      cropHeight: targetDims.height,
      targetWidth: targetDims.width,
      targetHeight: targetDims.height,
      scaleFactor: 1.0,
    };
  }

  const targetRatioNum = parseAspectRatioNumeric(targetRatio);
  const sourceRatioNum = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (Math.abs(sourceRatioNum - targetRatioNum) > 0.001) {
    if (sourceRatioNum > targetRatioNum) {
      // Source is wider than target -> crop horizontally
      cropWidth = Math.round(sourceHeight * targetRatioNum);
      cropHeight = sourceHeight;
      cropX = Math.round((sourceWidth - cropWidth) / 2);
      cropY = 0;
    } else {
      // Source is taller than target -> crop vertically
      cropWidth = sourceWidth;
      cropHeight = Math.round(sourceWidth / targetRatioNum);
      cropX = 0;
      cropY = Math.round((sourceHeight - cropHeight) / 2);
    }
  }

  const scaleFactor = targetDims.width / cropWidth;

  return {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    targetWidth: targetDims.width,
    targetHeight: targetDims.height,
    scaleFactor,
  };
}

/**
 * Format MIME Types.
 */
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
  quality?: number
): number {
  const totalPixels = width * height;

  // Base bytes per pixel at baseline quality
  let bpp = 0.08; // default WebP
  let targetQuality = quality;

  if (format === 'avif') {
    bpp = 0.05; // AVIF is ~38% smaller than WebP
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

  // Minimum floor for valid image container headers
  return Math.max(1024, estimatedBytes);
}

/**
 * Generates thumbnail variant records for an asset across aspect ratios and formats.
 */
export function generateThumbnailVariantSpecs(
  input: GenerateVariantsInput
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
 * Saves thumbnail variant specifications into D1 database.
 * Uses INSERT OR REPLACE to uphold the UNIQUE(asset_id, aspect_ratio, format) constraint.
 */
export async function saveThumbnailVariants(
  db: D1Database,
  variants: AssetThumbnailVariant[]
): Promise<number> {
  if (variants.length === 0) return 0;

  const sql = `
    INSERT OR REPLACE INTO asset_thumbnail_variants (
      id, asset_id, tenant_id, aspect_ratio, format,
      width, height, size_bytes, cdn_url, blur_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let inserted = 0;
  for (const v of variants) {
    await db.prepare(sql)
      .bind(
        v.id,
        v.assetId,
        v.tenantId,
        v.aspectRatio,
        v.format,
        v.width,
        v.height,
        v.sizeBytes,
        v.cdnUrl,
        v.blurHash,
        v.createdAt
      )
      .run();
    inserted++;
  }

  logger.info('Saved thumbnail variants to D1', {
    assetId: variants[0]?.assetId,
    count: inserted,
  });

  return inserted;
}

/**
 * Retrieves all registered thumbnail variants for an asset.
 */
export async function getThumbnailVariantsByAsset(
  db: D1Database,
  assetId: string
): Promise<AssetThumbnailVariant[]> {
  const sql = `
    SELECT id, asset_id, tenant_id, aspect_ratio, format,
           width, height, size_bytes, cdn_url, blur_hash, created_at
    FROM asset_thumbnail_variants
    WHERE asset_id = ?
    ORDER BY width DESC, format ASC
  `;

  const result = await db.prepare(sql).bind(assetId).all<AssetThumbnailVariantRow>();
  const rows = result.results ?? [];
  return rows.map(mapRowToThumbnailVariant);
}

/**
 * Finds the optimal variant matching preferred aspect ratio and format.
 */
export function selectOptimalVariant(
  variants: AssetThumbnailVariant[],
  preferredRatio: AspectRatio = '9:16',
  preferredFormat: ThumbnailFormat = 'webp'
): AssetThumbnailVariant | null {
  if (variants.length === 0) return null;

  // 1. Exact match on ratio & format
  const exact = variants.find(
    (v) => v.aspectRatio === preferredRatio && v.format === preferredFormat
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
