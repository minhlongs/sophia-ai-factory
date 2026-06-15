/**
 * Algorithm: enrich a base video description with the user's own affiliate
 * links. Delivers the homepage promise:
 *
 *   "Affiliate Program Discovery — Discover affiliate offers from PartnerStack,
 *    Impact.com, and Apollo. Manage your affiliate IDs to embed into video
 *    descriptions."
 *
 * Inputs:  userId, videoTitle (optional), nicheHint (optional), baseBody.
 * Output:  a description string with up to N affiliate URLs appended,
 *          each tracking the user's code + sub_id back to a click event.
 *
 * The function is pure-shape; the only I/O is one D1 read.  When the user
 * has no `affiliate_links` rows yet, the algorithm returns `baseBody`
 * unchanged so the description is never harmed by the absence of data.
 *
 * @module land/affiliates/video-description-injector
 */
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface AffiliateLinkForVideo {
  code: string;
  subId: string | null;
  offerTitle: string;
  productUrl: string;
  niche: string | null;
}

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
const URL_PARAM_REF = 'ref';
const URL_PARAM_SUB = 'sub_id';

interface LinkRow {
  code: string;
  sub_id: string | null;
  offer_title: string | null;
  product_url: string;
  niche: string | null;
}

/**
 * Append the user's tracking code + sub_id to the affiliate offer's
 * product URL. Existing query params are preserved.
 */
export function buildTrackedUrl(productUrl: string, code: string, subId: string | null): string {
  let url: URL;
  try {
    url = new URL(productUrl);
  } catch {
    // Bail out if the catalog row has a malformed URL — return as-is so the
    // description still surfaces *something* readable to the viewer.
    return productUrl;
  }
  // Overwrite ref/sub_id if they were already present; the user's link wins.
  url.searchParams.set(URL_PARAM_REF, code);
  if (subId && subId.trim().length > 0) {
    url.searchParams.set(URL_PARAM_SUB, subId);
  }
  return url.toString();
}

/**
 * Pure-function side: format the affiliate footer for the description.
 * Public so unit tests can exercise it without D1.
 */
export function formatAffiliateFooter(links: AffiliateLinkForVideo[]): string {
  if (links.length === 0) return '';
  const lines = links.map(
    (l) => `• ${l.offerTitle}: ${buildTrackedUrl(l.productUrl, l.code, l.subId)}`,
  );
  return ['', '🔗 Resources mentioned:', ...lines].join('\n');
}

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

  let rows: LinkRow[] = [];
  try {
    const db = createServerClient();
    // Pull all of the user's links + offer details. We over-fetch a bit and
    // then rank in-process so the JOIN stays simple and works on D1.
    const { data } = await db
      .from('affiliate_links')
      .select(
        'code, sub_id, affiliate_offers!inner(title, product_url, niche)',
      )
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false })
      .limit(20) as { data: Array<{
        code: string;
        sub_id: string | null;
        affiliate_offers: { title: string | null; product_url: string; niche: string | null };
      }> | null };

    rows = (data ?? []).map((row) => ({
      code: row.code,
      sub_id: row.sub_id,
      offer_title: row.affiliate_offers.title,
      product_url: row.affiliate_offers.product_url,
      niche: row.affiliate_offers.niche,
    }));
  } catch (err) {
    // D1 join via supabase-shim can fail in older migration states. Degrade
    // gracefully — the homepage promise still holds when the user simply has
    // no affiliate setup yet.
    logger.warn('[video-description-injector] affiliate fetch failed', toError(err), {
      userId: input.userId,
    });
  }

  // Niche boost: prefer offers that mention the niche hint in their `niche`
  // column. Stable ranking keeps the recency order for the rest.
  let appliedNicheBoost = false;
  if (niche.length > 0) {
    const matches = rows.filter((r) => r.niche?.toLowerCase().includes(niche));
    const rest = rows.filter((r) => !matches.includes(r));
    if (matches.length > 0) {
      appliedNicheBoost = true;
      rows = [...matches, ...rest];
    }
  }

  const picked = rows.slice(0, maxLinks).map<AffiliateLinkForVideo>((r) => ({
    code: r.code,
    subId: r.sub_id,
    offerTitle: r.offer_title ?? 'Resource',
    productUrl: r.product_url,
    niche: r.niche,
  }));

  const description = baseBody + formatAffiliateFooter(picked);

  return {
    description,
    links: picked,
    affiliateCount: picked.length,
    appliedNicheBoost,
  };
}
