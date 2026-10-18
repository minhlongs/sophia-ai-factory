/**
 * Curated Evergreen Affiliate Deal Catalog & Types for Autonomous Niche Video Cron
 * Layer: forest/cron (Infrastructure orchestrator)
 * @module forest/cron/autonomous-niche-video-catalog
 */

export interface AutonomousNicheDeal {
  niche: 'saas_global' | 'crypto_global';
  blueprintId: string;
  productName: string;
  productUrl: string;
  targetAudience: string;
  jurisdiction: string;
  affiliateCode: string;
}

export interface AutonomousNicheCronResult {
  success: boolean;
  totalCandidates: number;
  dispatchedCount: number;
  rejectedCount: number;
  error?: string;
}

// Curated high-converting evergreen affiliate deals
export const AUTONOMOUS_DEAL_CATALOG: AutonomousNicheDeal[] = [
  {
    niche: 'saas_global',
    blueprintId: 'saas_problem_agitation_solution',
    productName: 'FlowCraft AI',
    productUrl: 'https://flowcraft.ai/trial',
    targetAudience: 'Agency Founders & Operations Leads',
    jurisdiction: 'GLOBAL',
    affiliateCode: 'SOPHIA_AUTO',
  },
  {
    niche: 'saas_global',
    blueprintId: 'saas_listicle_top3_stack',
    productName: 'DataPulse Cloud',
    productUrl: 'https://datapulse.io/stack',
    targetAudience: 'Growth Marketers & Data Analysts',
    jurisdiction: 'GLOBAL',
    affiliateCode: 'SOPHIA_STACK',
  },
  {
    niche: 'crypto_global',
    blueprintId: 'crypto_fee_discount_signup_bonus',
    productName: 'Bybit Global',
    productUrl: 'https://bybit.com/register',
    targetAudience: 'Quantitative Traders & Crypto Enthusiasts',
    jurisdiction: 'US', // Has strict CFTC & SEC compliance requirement
    affiliateCode: 'SOPHIA_REBATE',
  },
  {
    niche: 'crypto_global',
    blueprintId: 'crypto_fee_discount_signup_bonus',
    productName: 'Binance International',
    productUrl: 'https://accounts.binance.com/register',
    targetAudience: 'Global Traders',
    jurisdiction: 'VN', // Should be blocked by VN promotional ban
    affiliateCode: 'SOPHIA_VIP_VN',
  },
];
