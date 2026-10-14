/**
 * Compute CTR for a variant.
 * Returns 0 when impressions === 0 to avoid division by zero.
 */
export function computeCtr(conversions: number, impressions: number): number {
  if (impressions === 0) return 0;
  return conversions / impressions;
}

export function computeAgeHours(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60);
}
