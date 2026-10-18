/**
 * Embed affiliate tools for OpenClaw Bridge
 * @module land/openclaw-telegram/embed-affiliate
 */

import { buildVideoDescription } from '@/land/affiliates/video-description-injector';

export interface EmbedAffiliateInput {
  userId: string;
  videoId?: string;
  baseBody?: string;
  nicheHint?: string;
  maxLinks?: number;
}

export interface EmbedAffiliateResult {
  description: string;
  affiliateCount: number;
}

export async function callEmbedAffiliateInDescription(
  input: EmbedAffiliateInput,
): Promise<EmbedAffiliateResult> {
  const result = await buildVideoDescription({
    userId: input.userId,
    baseBody: input.baseBody,
    videoTitle: input.videoId,
    nicheHint: input.nicheHint,
    maxLinks: input.maxLinks,
  });
  return { description: result.description, affiliateCount: result.affiliateCount };
}