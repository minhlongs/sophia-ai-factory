/**
 * Commerce Video Attribution Injector
 *
 * Injects affiliate referral tokens, UTM tracking tags, and platform-specific
 * metadata into generated marketing video payloads.
 *
 * Layer: land (commerce domain workflow)
 * @module land/commerce/commerce-attribution-injector
 */

export interface VideoAttributionParams {
  partnerCode: string;
  campaignSubId?: string;
  productId: string;
  productTitle: string;
  storeId: string;
  baseUrl?: string;
}

export interface InjectedVideoMetadata {
  attributionToken: string;
  referralUrl: string;
  youtubeDescriptionBlock: string;
  youtubePinnedComment: string;
  tiktokCaptionSnippet: string;
  structuredTags: string[];
}

export function generateAttributionToken(params: VideoAttributionParams): string {
  const sub = params.campaignSubId ? `_${params.campaignSubId}` : '';
  return `ATTR_${params.partnerCode}${sub}_${params.productId.slice(0, 8)}_${Date.now().toString(36)}`;
}

export function buildAttributedReferralUrl(
  partnerCode: string,
  campaignSubId?: string,
  baseUrl = 'https://sophia.agencyos.network'
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const sub = campaignSubId ? `?sub_id=${encodeURIComponent(campaignSubId)}` : '';
  return `${cleanBase}/r/${encodeURIComponent(partnerCode)}${sub}`;
}

export function injectCommerceAttribution(
  params: VideoAttributionParams
): InjectedVideoMetadata {
  const referralUrl = buildAttributedReferralUrl(
    params.partnerCode,
    params.campaignSubId,
    params.baseUrl
  );
  const attributionToken = generateAttributionToken(params);

  const youtubeDescriptionBlock = [
    `🔥 Featured Product: ${params.productTitle}`,
    `👉 Get Yours Here: ${referralUrl}`,
    '',
    `[Verified Partner: ${params.partnerCode} | Token: ${attributionToken}]`,
    'Disclosure: Commissions earned through verified affiliate links support our channel.',
  ].join('\n');

  const youtubePinnedComment = `Get 10% off ${params.productTitle} with our verified creator link: ${referralUrl}`;
  const tiktokCaptionSnippet = `Shop ${params.productTitle.slice(0, 30)} 🔗 Link in Bio [Code: ${params.partnerCode}] #partner #ad #tiktokmademebuyit`;

  const structuredTags = [
    `partner_${params.partnerCode}`,
    `product_${params.productId}`,
    `store_${params.storeId}`,
    params.campaignSubId ? `sub_${params.campaignSubId}` : '',
    'sophia_commerce',
  ].filter(Boolean);

  return {
    attributionToken,
    referralUrl,
    youtubeDescriptionBlock,
    youtubePinnedComment,
    tiktokCaptionSnippet,
    structuredTags,
  };
}
