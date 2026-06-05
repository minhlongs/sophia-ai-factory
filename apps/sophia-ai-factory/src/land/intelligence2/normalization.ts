/**
 * Normalizes a commission amount (USD) to a 0-100 scale.
 * Assuming > $100 avg commission is excellent.
 */
export function normalizeCommission(amount: number | null | undefined): number {
  if (!amount || amount < 0) return 0

  // Linear scaling up to $150
  // $0 -> 0
  // $50 -> 33
  // $100 -> 66
  // $150+ -> 100

  const MAX_COMMISSION = 150
  return Math.min((amount / MAX_COMMISSION) * 100, 100)
}

/**
 * Normalizes ClickBank Gravity (0 to ~800+) to 0-100 scale using Logarithmic scale.
 * We want Gravity 50 to be a decent score, Gravity 100 to be high.
 */
export function normalizeClickBankGravity(gravity: number | null | undefined): number {
  if (!gravity || gravity <= 0) return 0

  // Log scale: score = log(gravity) / log(max_gravity) * 100
  // Let's say max gravity effectively is 500 for normalization purposes.
  // log10(500) ~= 2.7
  // log10(1) = 0
  // log10(10) = 1 -> 37/100
  // log10(50) ~= 1.7 -> 63/100
  // log10(100) = 2 -> 74/100

  // Adjusted formula to boost lower gravity slightly:
  // (Math.log10(gravity + 1) / Math.log10(501)) * 100

  const score = (Math.log10(gravity + 1) / 2.7) * 100
  return Math.min(Math.max(score, 0), 100)
}

/**
 * Normalizes ShareASale Power Rank (1 to ~5000+) to 0-100 scale.
 * Rank 1 is best (100), Rank 1000 is okay, Rank 5000+ is poor.
 */
export function normalizeShareASaleRank(rank: number | null | undefined): number {
  if (!rank || rank <= 0) return 0

  // Inverse scale.
  // We care most about Top 1000.
  // If rank <= 100: Score 90-100
  // If rank <= 1000: Score 50-90
  // If rank > 1000: Score < 50

  if (rank <= 100) {
    // 1 -> 100, 100 -> 90
    return 100 - ((rank / 100) * 10)
  }

  if (rank <= 1000) {
    // 100 -> 90, 1000 -> 50
    // Linear interpolation between (100, 90) and (1000, 50)
    // slope = (50 - 90) / (1000 - 100) = -40 / 900 = -0.044
    return 90 + (rank - 100) * -0.0444
  }

  // Rank > 1000
  // 1000 -> 50, 5000 -> 0
  const score = 50 - ((rank - 1000) / 4000) * 50
  return Math.max(score, 0)
}

/**
 * Normalizes reliability metrics (Refund rate, Rebill rate).
 * For MVP, we often don't have direct refund rates.
 * We can use Rebill/Recurring as a proxy for LTV/Reliability if available.
 */
export function normalizeReliability(metrics: Record<string, unknown>): number {
  // Placeholder logic
  // ClickBank: has 'totalRebillAmt' or 'initialEarningsPerSale' vs 'averageEarningsPerSale'

  if (metrics.recurring || (metrics.totalRebillAmt as number) > 0) {
    return 80 // Recurring products are generally more reliable income
  }

  return 50 // Default neutral
}
