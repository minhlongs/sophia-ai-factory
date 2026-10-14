/**
 * Calculate pro-rata credit for unused days on current tier.
 * Returns credit in USD cents.
 */
export function calculateProRataCredit(
  currentTierPrice: number,
  periodStart: string,
  periodEnd: string,
): number {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const now = Date.now();

  if (now >= end || now <= start) return 0;

  const totalMs = end - start;
  const usedMs = now - start;
  const remainingRatio = 1 - usedMs / totalMs;

  return Math.max(0, Math.round(currentTierPrice * remainingRatio));
}
