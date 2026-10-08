export interface VideoPerformance {
  spend: number;        // Cost to produce/distribute (e.g., MCU equivalent in cents)
  revenue: number;      // Attributed revenue
  conversions: number;  // Number of attributed conversions
  views?: number;       // Optional views
}

export interface RoiMetrics {
  roas: number;        // Return on spend (revenue / spend)
  cpa: number;         // Cost per acquisition (spend / conversions)
  ltvScore: number;    // Predicted lifetime value heuristic
}

/**
 * Calculates ROI and LTV metrics for a single video's performance.
 * Domain logic is pure and stateless.
 */
export function calculateRoiMetrics(stats: VideoPerformance): RoiMetrics {
  // Prevent division by zero
  const safeSpend = Math.max(stats.spend, 0.01);

  const roas = stats.revenue / safeSpend;
  const cpa = stats.conversions > 0 ? stats.spend / stats.conversions : 0;
  
  // Basic heuristic LTV score: higher conversions and higher average revenue per conversion
  // multiplied by a viral/retention factor if views exist.
  const averageRevenuePerConversion = stats.conversions > 0 
    ? stats.revenue / stats.conversions 
    : 0;

  // LTV Score combines direct ROAS scale with conversion consistency
  // If ROAS > 1.0, LTV score accelerates.
  const baseLtv = averageRevenuePerConversion * stats.conversions;
  const ltvScore = baseLtv * (roas > 1 ? roas : roas * 0.5);

  return {
    roas: Number(roas.toFixed(4)),
    cpa: Number(cpa.toFixed(4)),
    ltvScore: Number(ltvScore.toFixed(4))
  };
}
