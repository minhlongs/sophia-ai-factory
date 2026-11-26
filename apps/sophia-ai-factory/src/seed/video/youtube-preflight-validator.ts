/**
 * Zero-Quota YouTube Data API v3 Pre-Flight Metadata & Chapter Validator.
 *
 * Clean-room primitive (MIT pattern from joinhackyard/youtube-channel-mcp):
 * validates title length (<=60 target / 100 hard cap), UTF-8 description byte
 * budget (<=5000 bytes), and chapter rules (starts at 0:00, >=3 chapters,
 * >=10s spacing) before spending any YouTube Data API quota.
 *
 * Layer: seed/video (pure deterministic validator)
 *
 * @module seed/video/youtube-preflight-validator
 */

export interface YouTubeMetadataPreflightInput {
  readonly title: string;
  readonly description: string;
}

export interface YouTubeMetadataPreflightResult {
  readonly valid: boolean;
  readonly titleChars: number;
  readonly descriptionUtf8Bytes: number;
  readonly chapterCount: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const CHAPTER_REGEX = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/gm;

function parseTimestampSec(hours: string | undefined, mins: string, secs: string): number {
  return (hours ? Number(hours) * 3600 : 0) + Number(mins) * 60 + Number(secs);
}

export function validateYouTubeMetadataPreflight(
  input: YouTubeMetadataPreflightInput,
): YouTubeMetadataPreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = input.title.trim();
  const titleChars = title.length;
  if (titleChars === 0) errors.push('TITLE_EMPTY');
  if (titleChars > 100) errors.push(`TITLE_EXCEEDS_100_CHARS:${titleChars}`);
  else if (titleChars > 60) warnings.push(`TITLE_OVER_60_CTR_TARGET:${titleChars}`);

  const descriptionUtf8Bytes = new TextEncoder().encode(input.description).byteLength;
  if (descriptionUtf8Bytes > 5000) {
    errors.push(`DESCRIPTION_EXCEEDS_5000_UTF8_BYTES:${descriptionUtf8Bytes}`);
  }

  const timestamps: number[] = [];
  for (const match of input.description.matchAll(CHAPTER_REGEX)) {
    timestamps.push(parseTimestampSec(match[1], match[2], match[3]));
  }

  if (timestamps.length > 0) {
    if (timestamps[0] !== 0) errors.push('CHAPTERS_MUST_START_AT_0_00');
    if (timestamps.length < 3) errors.push(`CHAPTERS_MIN_3_REQUIRED:${timestamps.length}`);
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] < 10) {
        errors.push(`CHAPTER_SPACING_UNDER_10S_AT_INDEX_${i}`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    titleChars,
    descriptionUtf8Bytes,
    chapterCount: timestamps.length,
    errors,
    warnings,
  };
}
