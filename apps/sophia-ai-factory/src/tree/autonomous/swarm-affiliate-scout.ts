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

import { DEFAULT_CANDIDATE_OFFERS } from './swarm-affiliate-catalog';

export { DEFAULT_CANDIDATE_OFFERS } from './swarm-affiliate-catalog';

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
