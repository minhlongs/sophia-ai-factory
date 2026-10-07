/**
 * AI Video Creative Studio & Splitter
 *
 * Provides domain logic to segment video scripts into sub-60-second high-energy
 * vertical reels with dynamic thumbnail metadata and high-converting text overlays.
 *
 * Layer: tree/affiliate/creative (Domain Logic)
 * @module tree/affiliate/creative/video-splitter-studio
 */

export interface VideoSegmentScript {
  segmentId: string;
  hookTitle: string;
  hookOverlayText: string;
  durationSeconds: number;
  targetPlatform: 'tiktok_shop' | 'youtube_shorts' | 'instagram_reels';
  soundtrackMood: 'high_energy' | 'suspense' | 'ambient';
  thumbnailHeadline: string;
  tags: string[];
}

export interface SplitterInput {
  campaignId: string;
  productName: string;
  rawScript: string;
  niche: 'saas_global' | 'crypto_global' | 'ecommerce_tiktok';
  targetDurationSeconds?: number;
}

/**
 * Splits raw long-form copy/script into high-retention segments suitable for TikTok Shop / Reels.
 */
export function generateVideoSegments(input: SplitterInput): VideoSegmentScript[] {
  const { campaignId, productName, rawScript, niche } = input;
  const maxSegmentLength = input.targetDurationSeconds ?? 45;

  const sentences = rawScript
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (sentences.length === 0) {
    throw new Error('Script too short to split into video segments');
  }

  const segments: VideoSegmentScript[] = [];
  const chunkSize = Math.max(2, Math.ceil(sentences.length / 3));

  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunkSentences = sentences.slice(i, i + chunkSize);
    const index = Math.floor(i / chunkSize) + 1;

    let overlay = `SỐC: ${productName.toUpperCase()}!`;
    let headline = `Đừng mua ${productName} trước khi xem cái này!`;

    if (niche === 'crypto_global') {
      overlay = `TÍN HIỆU X100: ${productName.toUpperCase()}`;
      headline = `Cá mập đang gom ${productName}?`;
    } else if (niche === 'saas_global') {
      overlay = `TIẾT KIỆM 10H/TUẦN VỚI ${productName.toUpperCase()}`;
      headline = `Bí mật công cụ AI thay thế nhân sự 2026`;
    }

    // Estimate duration: ~2.5 words per second
    const totalWords = chunkSentences.join(' ').split(/\s+/).length;
    const estimatedDuration = Math.min(
      maxSegmentLength,
      Math.max(15, Math.round(totalWords / 2.5))
    );

    segments.push({
      segmentId: `${campaignId}_part_${index}`,
      hookTitle: chunkSentences[0] || `${productName} Part ${index}`,
      hookOverlayText: overlay,
      durationSeconds: estimatedDuration,
      targetPlatform: 'tiktok_shop',
      soundtrackMood: index === 1 ? 'suspense' : 'high_energy',
      thumbnailHeadline: headline,
      tags: [niche, 'affiliate', 'viral', productName.toLowerCase().replace(/\s+/g, '_')],
    });
  }

  return segments;
}

/**
 * Validates whether a segment adheres to viral short-form specs.
 */
export function validateSegmentCompliance(segment: VideoSegmentScript): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (segment.durationSeconds > 60) {
    errors.push('Duration exceeds TikTok 60s hard ceiling');
  }
  if (segment.durationSeconds < 10) {
    errors.push('Duration too short for platform monetization');
  }
  if (!segment.hookOverlayText || segment.hookOverlayText.length < 5) {
    errors.push('Missing impactful hook overlay text');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
