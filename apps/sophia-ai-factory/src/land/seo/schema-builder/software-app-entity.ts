import { SITE_URL, SchemaSoftwareApplication } from './types';

/**
 * Builds the SoftwareApplication entity schema.
 */
export function buildSoftwareApplicationEntity(baseUrl: string = SITE_URL): SchemaSoftwareApplication {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${baseUrl}/#software`,
    name: 'Sophia AI Factory',
    url: baseUrl,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Cloud-based Web Platform (Cloudflare Edge)',
    description:
      'Omnichannel AI video factory for global creators and businesses with multi-channel publishing and automated lead qualification.',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '99',
      highPrice: '4999',
      offerCount: '4',
    },
    featureList:
      'AI Scriptwriting, Multi-channel publishing (TikTok, YouTube Shorts, X), Voice cloning, Referral funnel tracking, Automated Telegram lead qualification, SOLO100 checkout',
    author: {
      '@type': 'Organization',
      name: 'Sophia AI Factory',
      url: baseUrl,
    },
  };
}
