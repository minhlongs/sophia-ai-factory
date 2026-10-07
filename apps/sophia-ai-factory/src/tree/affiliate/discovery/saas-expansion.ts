/**
 * Data Discovery Expansion (SaaS)
 *
 * Scans emerging SaaS product metrics for early-growth signals.
 *
 * Layer: tree/affiliate/discovery/saas-expansion
 */

export interface GrowthSignal {
  productId: string;
  velocity: number; // upvotes per hour
  nicheMarket: 'ai_agent' | 'dev_tool' | 'marketing' | 'undefined';
}

export interface RawSaaSItem {
  id: string;
  votesCount: number;
}

export function detectGrowthVelocity(
  items: RawSaaSItem[],
): GrowthSignal[] {
  // Logic to identify high-velocity products (e.g., > 10 upvotes/hr)
  return items.map(item => ({
    productId: item.id,
    velocity: item.votesCount / 24, // simplified daily velocity
    nicheMarket: 'ai_agent', // stub for expansion logic
  }));
}
