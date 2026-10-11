/**
 * Currency formatters and conversion utilities
 * Layer: forest/components/pricing/card
 */

export function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Format VND amount for display (e.g. "4.975.000 ₫").
 * Receives VND integer (not cents).
 */
export function formatVnd(vnd: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(vnd);
}

/** Pinned display exchange rate. Runtime conversions use USD_TO_VND env var in payos.ts. */
export const USD_TO_VND_DISPLAY = 25500;

/** Convert USD cents to VND, rounded to nearest 1,000 VND. */
export function centsToVnd(cents: number): number {
  const usd = cents / 100;
  return Math.round((usd * USD_TO_VND_DISPLAY) / 1000) * 1000;
}
