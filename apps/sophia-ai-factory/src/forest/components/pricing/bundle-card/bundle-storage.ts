/**
 * Session storage helpers for pending purchases
 *
 * Layer: forest/components/pricing/bundle-card
 */

import { PENDING_KEY, PENDING_TTL_MS, type PendingPurchase } from "./types";

/** Read pending purchase from sessionStorage; returns null if expired or absent. */
export function readPendingPurchase(): PendingPurchase | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPurchase;
    if (Date.now() - parsed.createdAt > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Store pending purchase in sessionStorage. */
export function writePendingPurchase(paymentUrl: string, skuId: string): void {
  try {
    const data: PendingPurchase = { paymentUrl, skuId, createdAt: Date.now() };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage not available (SSR, private mode) — non-fatal
  }
}

/** Clear pending purchase from sessionStorage. */
export function clearPendingPurchase(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // non-fatal
  }
}

/** Produce a localized error message for a checkout API failure. */
export function errorMessageFor(
  status: number,
  serverError: string | undefined,
  lang: "vi" | "en"
): string {
  if (status === 401) {
    return lang === "vi"
      ? "Bạn cần đăng nhập trước khi thanh toán"
      : "Please log in to checkout";
  }
  if (status === 400) {
    return lang === "vi"
      ? "Yêu cầu không hợp lệ. Vui lòng tải lại trang"
      : "Invalid request. Refresh and try again";
  }
  if (status === 429) {
    return lang === "vi"
      ? "Quá nhiều yêu cầu. Thử lại sau ít phút"
      : "Too many requests. Try again in a few minutes";
  }
  return lang === "vi"
    ? `Hệ thống đang gặp sự cố. Thử lại sau${serverError ? ` (${serverError})` : ""}`
    : `System error. Please try again later${serverError ? ` (${serverError})` : ""}`;
}
