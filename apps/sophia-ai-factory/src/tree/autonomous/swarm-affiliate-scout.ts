/**
 * Affiliate Scout Capability Domain Models & Logic
 * Tree Layer - Deterministic affiliate program scanning and tier classification
 *
 * @module tree/autonomous/swarm-affiliate-scout
 */

export interface AffiliateOffer {
  id: string;
  programName: string;
  network: 'Impact' | 'PartnerStack' | 'CJ Affiliate' | 'ShareASale' | 'Custom';
  category: 'Fintech' | 'Crypto' | 'SaaS' | 'AI' | 'E-commerce';
  epc: number; // Earnings Per Click in USD
  commissionRate: number; // Commission amount in USD
  commissionType: 'flat' | 'percentage';
  landingPageUrl: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  highEpcAlert: boolean;
}

export interface AffiliateScoutInput {
  minEpc?: number;
  minCommission?: number;
  targetCategories?: string[];
  candidateOffers?: AffiliateOffer[];
}

export interface AffiliateScoutOutput {
  scannedNetworks: string[];
  totalScanned: number;
  qualifiedOffers: AffiliateOffer[];
  highEpcAlerts: AffiliateOffer[];
  summary: {
    basicCount: number;
    premiumCount: number;
    enterpriseCount: number;
    avgEpc: number;
  };
}

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

/**
 * Classifies an offer into an operational tier based on EPC and commission rate.
 */
export function classifyAffiliateTier(
  epc: number,
  commissionRate: number,
): 'BASIC' | 'PREMIUM' | 'ENTERPRISE' {
  if (epc >= 20 || commissionRate >= 200) {
    return 'ENTERPRISE';
  }
  if (epc >= 10 || commissionRate >= 100) {
    return 'PREMIUM';
  }
  return 'BASIC';
}

/**
 * Discovers and filters affiliate offers according to HEARTBEAT criteria (EPC >= $5, Commission >= $50).
 */
export function discoverAffiliateOffers(
  input: AffiliateScoutInput = {},
): AffiliateScoutOutput {
  const minEpc = input.minEpc ?? 5.0;
  const minCommission = input.minCommission ?? 50.0;
  const candidates = input.candidateOffers ?? DEFAULT_CANDIDATE_OFFERS;
  const targetCategories = input.targetCategories;

  const qualified: AffiliateOffer[] = [];
  const highAlerts: AffiliateOffer[] = [];
  const networksSeen = new Set<string>();

  for (const raw of candidates) {
    networksSeen.add(raw.network);

    if (raw.epc < minEpc || raw.commissionRate < minCommission) {
      continue;
    }

    if (targetCategories && !targetCategories.includes(raw.category)) {
      continue;
    }

    const tier = classifyAffiliateTier(raw.epc, raw.commissionRate);
    const highEpcAlert = raw.epc >= 20.0;

    const offer: AffiliateOffer = {
      ...raw,
      tier,
      highEpcAlert,
    };

    qualified.push(offer);
    if (highEpcAlert) {
      highAlerts.push(offer);
    }
  }

  const basicCount = qualified.filter((o) => o.tier === 'BASIC').length;
  const premiumCount = qualified.filter((o) => o.tier === 'PREMIUM').length;
  const enterpriseCount = qualified.filter((o) => o.tier === 'ENTERPRISE').length;
  const totalEpc = qualified.reduce((acc, o) => acc + o.epc, 0);
  const avgEpc = qualified.length > 0 ? Math.round((totalEpc / qualified.length) * 100) / 100 : 0;

  return {
    scannedNetworks: Array.from(networksSeen),
    totalScanned: candidates.length,
    qualifiedOffers: qualified,
    highEpcAlerts: highAlerts,
    summary: {
      basicCount,
      premiumCount,
      enterpriseCount,
      avgEpc,
    },
  };
}
