/**
 * Enrich a base video description with the user's affiliate links and
 * dual-market regulatory compliance disclosures (US FTC #ad, VN #QuảngCáo).
 * @module land/affiliates/video-description-injector
 */
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resolveAudienceJurisdiction } from '@/tree/affiliates/audience-jurisdiction';
import {
  evaluateDistributionLegality,
  buildPublishDisclosure,
} from '@/tree/affiliates/distribution-compliance-gate';
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
  locale?: 'en' | 'vi';
  jurisdiction?: string | null;
}

export interface VideoDescriptionResult {
  description: string;
  links: AffiliateLinkForVideo[];
  affiliateCount: number;
  appliedNicheBoost: boolean;
  affiliateDisclosureEmitted?: boolean;
}

const DEFAULT_MAX_LINKS = 3;

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
  if (picked.length === 0) {
    return { description: baseBody, links: [], affiliateCount: 0, appliedNicheBoost: false, affiliateDisclosureEmitted: false };
  }

  const resolvedJurisdiction =
    input.jurisdiction !== undefined ? input.jurisdiction : await resolveAudienceJurisdiction(input.userId);
  const locale: 'en' | 'vi' = input.locale ?? (resolvedJurisdiction?.toUpperCase() === 'VN' ? 'vi' : 'en');

  const allowedLinks = picked.filter((link) => {
    const verdict = evaluateDistributionLegality({
      offerCategory: link.niche,
      offerName: link.offerTitle,
      jurisdiction: resolvedJurisdiction,
      hasAffiliateLink: true,
    });
    if (!verdict.allowed) {
      logger.warn('[video-description-injector] blocked affiliate link on compliance grounds', {
        userId: input.userId,
        code: link.code,
        reason: verdict.reason,
      });
    }
    return verdict.allowed;
  });

  if (allowedLinks.length === 0) {
    return { description: baseBody, links: [], affiliateCount: 0, appliedNicheBoost: false, affiliateDisclosureEmitted: false };
  }

  const primaryVerdict = evaluateDistributionLegality({
    offerCategory: allowedLinks[0].niche,
    offerName: allowedLinks[0].offerTitle,
    jurisdiction: resolvedJurisdiction,
    hasAffiliateLink: true,
  });
  const disclosure = buildPublishDisclosure(primaryVerdict, resolvedJurisdiction, locale);
  const description = baseBody + formatAffiliateFooter(allowedLinks) + (disclosure ? `\n\n${disclosure}` : '');

  return {
    description,
    links: allowedLinks,
    affiliateCount: allowedLinks.length,
    appliedNicheBoost,
    affiliateDisclosureEmitted: Boolean(disclosure),
  };
}
