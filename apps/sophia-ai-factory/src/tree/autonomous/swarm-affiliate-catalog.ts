/**
 * Default Candidate Affiliate Offers Catalog for Swarm Affiliate Scout.
 * @module tree/autonomous/swarm-affiliate-catalog
 */

import type { AffiliateOffer } from './swarm-affiliate-scout';

/**
 * Standard baseline catalog of candidate affiliate programs derived from openclaw.json & HEARTBEAT.md.
 */
export const DEFAULT_CANDIDATE_OFFERS: AffiliateOffer[] = [
  {
    id: 'aff-tradingview',
    programName: 'TradingView Pro & Premium',
    network: 'Impact',
    category: 'Fintech',
    epc: 8.5,
    commissionRate: 65,
    commissionType: 'flat',
    landingPageUrl: 'https://tradingview.com/pricing',
    tier: 'PREMIUM',
    highEpcAlert: false,
  },
  {
    id: 'aff-notion-ai',
    programName: 'Notion AI Workspace',
    network: 'PartnerStack',
    category: 'SaaS',
    epc: 6.2,
    commissionRate: 55,
    commissionType: 'flat',
    landingPageUrl: 'https://notion.so/product/ai',
    tier: 'BASIC',
    highEpcAlert: false,
  },
  {
    id: 'aff-binance-vip',
    programName: 'Binance Institutional Referral',
    network: 'Custom',
    category: 'Crypto',
    epc: 24.5,
    commissionRate: 250,
    commissionType: 'flat',
    landingPageUrl: 'https://binance.com/activity/referral',
    tier: 'ENTERPRISE',
    highEpcAlert: true,
  },
  {
    id: 'aff-synthesia',
    programName: 'Synthesia Video AI Suite',
    network: 'PartnerStack',
    category: 'AI',
    epc: 12.0,
    commissionRate: 120,
    commissionType: 'flat',
    landingPageUrl: 'https://synthesia.io/pricing',
    tier: 'PREMIUM',
    highEpcAlert: false,
  },
  {
    id: 'aff-shopify-plus',
    programName: 'Shopify Plus Partner Program',
    network: 'Impact',
    category: 'E-commerce',
    epc: 32.0,
    commissionRate: 300,
    commissionType: 'flat',
    landingPageUrl: 'https://shopify.com/plus',
    tier: 'ENTERPRISE',
    highEpcAlert: true,
  },
  {
    id: 'aff-low-epc-sample',
    programName: 'Low EPC Gadget Store',
    network: 'CJ Affiliate',
    category: 'E-commerce',
    epc: 1.5,
    commissionRate: 15,
    commissionType: 'flat',
    landingPageUrl: 'https://example.com/gadgets',
    tier: 'BASIC',
    highEpcAlert: false,
  },
];
