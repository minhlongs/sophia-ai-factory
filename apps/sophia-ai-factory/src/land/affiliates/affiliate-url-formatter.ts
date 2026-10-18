/**
 * Affiliate URL tracking and video description footer formatting helpers.
 *
 * @module land/affiliates/affiliate-url-formatter
 */

export interface AffiliateLinkForVideo {
  code: string;
  subId: string | null;
  offerTitle: string;
  productUrl: string;
  niche: string | null;
}

export interface AffiliateLinkRow {
  code: string;
  sub_id: string | null;
  offer_title: string | null;
  product_url: string;
  niche: string | null;
}

const URL_PARAM_REF = 'ref';
const URL_PARAM_SUB = 'sub_id';

/**
 * Append the user's tracking code + sub_id to the affiliate offer's
 * product URL. Existing query params are preserved.
 */
export function buildTrackedUrl(
  productUrl: string,
  code: string,
  subId: string | null,
): string {
  let url: URL;
  try {
    url = new URL(productUrl);
  } catch {
    return productUrl;
  }
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
 * Rank affiliate rows with optional niche boost and slice to maxLinks.
 */
export function rankAndPickAffiliateLinks(
  rows: AffiliateLinkRow[],
  niche: string,
  maxLinks: number,
): { picked: AffiliateLinkForVideo[]; appliedNicheBoost: boolean } {
  let ordered = rows;
  let appliedNicheBoost = false;

  if (niche.length > 0) {
    const matches = rows.filter((r) => r.niche?.toLowerCase().includes(niche));
    const rest = rows.filter((r) => !matches.includes(r));
    if (matches.length > 0) {
      appliedNicheBoost = true;
      ordered = [...matches, ...rest];
    }
  }

  const picked = ordered.slice(0, maxLinks).map<AffiliateLinkForVideo>((r) => ({
    code: r.code,
    subId: r.sub_id,
    offerTitle: r.offer_title ?? 'Resource',
    productUrl: r.product_url,
    niche: r.niche,
  }));

  return { picked, appliedNicheBoost };
}
