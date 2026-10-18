/**
 * Algorithm: enrich a base video description with the user's own affiliate
 * links. Delivers the homepage promise:
 *
 *   "Affiliate Program Discovery — Discover affiliate offers from PartnerStack,
 *    Impact.com, and Apollo. Manage your affiliate IDs to embed into video
 *    descriptions."
 *
 * @module land/affiliates/video-description-injector
 */
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  buildTrackedUrl,
  formatAffiliateFooter,
  rankAndPickAffiliateLinks,
  type AffiliateLinkForVideo,
  type AffiliateLinkRow,
} from './affiliate-url-formatter';

export { buildTrackedUrl, formatAffiliateFooter, type AffiliateLinkForVideo };

export interface BuildVideoDescriptionInput {
  userId: string;
  baseBody?: string;
  videoTitle?: string;
  nicheHint?: string;
  maxLinks?: number;
}

export interface VideoDescriptionResult {
  description: string;
  links: AffiliateLinkForVideo[];
  affiliateCount: number;
  appliedNicheBoost: boolean;
}

const DEFAULT_MAX_LINKS = 3;

/**
 * Compose: fetch user's affiliate_links (joined to offers) and append a
 * tracked URL block to the supplied baseBody.
 */
export async function buildVideoDescription(
  input: BuildVideoDescriptionInput,
): Promise<VideoDescriptionResult> {
  const maxLinks = Math.max(1, Math.min(input.maxLinks ?? DEFAULT_MAX_LINKS, 5));
  const baseBody = input.baseBody?.trim() ?? '';
  const niche = input.nicheHint?.trim().toLowerCase() ?? '';

  let rows: AffiliateLinkRow[] = [];
  try {
    const db = createServerClient();
    const { data } = (await db
      .from('affiliate_links')
      .select('code, sub_id, affiliate_offers!inner(title, product_url, niche)')
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false })
      .limit(20)) as {
      data: Array<{
        code: string;
        sub_id: string | null;
        affiliate_offers: { title: string | null; product_url: string; niche: string | null };
      }> | null;
    };

    rows = (data ?? []).map((row) => ({
      code: row.code,
      sub_id: row.sub_id,
      offer_title: row.affiliate_offers.title,
      product_url: row.affiliate_offers.product_url,
      niche: row.affiliate_offers.niche,
    }));
  } catch (err) {
    logger.warn('[video-description-injector] affiliate fetch failed', toError(err), {
      userId: input.userId,
    });
  }

  const { picked, appliedNicheBoost } = rankAndPickAffiliateLinks(rows, niche, maxLinks);
  const description = baseBody + formatAffiliateFooter(picked);

  return {
    description,
    links: picked,
    affiliateCount: picked.length,
    appliedNicheBoost,
  };
}
