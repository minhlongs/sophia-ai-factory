/**
 * Magic bytes MIME type detector for brand kit assets
 *
 * @module app/actions/brand-kit/mime-detector
 */

/** Detect MIME type from file magic bytes (first 12 bytes). */
export function detectMimeType(buffer: Buffer): string | null {
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp';
  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  // SVG (text-based, check first bytes)
  if (buffer[0] === 0x3c && buffer[1] === 0x3f && buffer[2] === 0x78 && buffer[3] === 0x6d) return 'image/svg+xml';
  // MP4
  if (buffer[4] === 0x66 && buffer[5] === 0x79 && buffer[6] === 0x70) return 'video/mp4';
  // WEBM
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'video/webm';
  // TTF
  if (buffer[0] === 0x00 && buffer[1] === 0x01 && buffer[2] === 0x00 && buffer[3] === 0x00) return 'font/ttf';
  // OTF
  if (buffer[0] === 0x4f && buffer[1] === 0x54 && buffer[2] === 0x54 && buffer[3] === 0x4f) return 'font/otf';
  // WOFF
  if (buffer[0] === 0x77 && buffer[1] === 0x4f && buffer[2] === 0x46 && buffer[3] === 0x46) return 'font/woff';
  // WOFF2
  if (buffer[0] === 0x77 && buffer[1] === 0x4f && buffer[2] === 0x46 && buffer[3] === 0x32) return 'font/woff2';
  return null;
}
