/**
 * Bridge Link Generator
 *
 * Generates dynamic Bio-Link / Bridge Page metadata for affiliate products.
 *
 * Layer: tree/affiliate/bridge (Domain Logic)
 * @module tree/affiliate/bridge/link-generator
 */

export interface BridgeLinkOptions {
  productId: string;
  niche: 'saas_global' | 'crypto_global';
  campaignId?: string;
  couponCode?: string;
  locale: string;
}

export function generateSaaSBridgeUrl(options: BridgeLinkOptions): string {
  const baseUrl = `https://sophia.agencyos.network/${options.locale}/affiliate/bridge/${options.productId}`;
  const params = new URLSearchParams({
    campaign: options.campaignId || 'default',
    ref: 'sophia_ai',
  });
  if (options.couponCode) params.append('code', options.couponCode);
  return `${baseUrl}?${params.toString()}`;
}
