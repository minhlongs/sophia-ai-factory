"use client";

/**
 * OneTimeBundleCard — pricing card for one-time bundle purchases.
 * Bilingual (Vi/En) via next-intl useLocale.
 * Tone-matches existing pricing cards (Tailwind 4 classes).
 *
 * Features:
 * - HeyGen health gate: disables CTA with maintenance message when heygenHealthy=false
 * - Error toast: shows localized error below CTA on checkout API failures
 * - P0.5: Pending purchase guard — sessionStorage flag prevents double-click invoices.
 *   On mount, checks for sophia_pending_purchase key (< 30 min); if present, shows
 *   "complete or cancel" banner with link to the pending NOWPayments URL.
 *
 * @module components/pricing/one-time-bundle-card
 */

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ONE_TIME_SKUS } from "@/config/one-time-skus";
import type { OneTimeSku } from "@/types";

const STARTER = ONE_TIME_SKUS.STARTER_BUNDLE;
const PENDING_KEY = "sophia_pending_purchase";
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface PendingPurchase {
  paymentUrl: string
  createdAt: number
  skuId: string
}

interface OneTimeBundleCardProps {
  /** Override SKU — defaults to STARTER_BUNDLE */
  sku?: OneTimeSku;
  /** User id for order_id in checkout URL */
  userId?: string;
  /** Whether HeyGen provider is currently healthy (from server-side pre-flight) */
  heygenHealthy?: boolean;
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckIcon />
      {text}
    </li>
  );
}

const FEATURES: Record<"vi" | "en", string[]> = {
  vi: [
    "10 video AI — trả một lần, dùng mãi",
    "Hiệu lực 12 tháng từ ngày thanh toán",
    "Không phí hàng tháng",
    "Giao video tự động sau thanh toán",
    "Dashboard theo dõi số dư credits",
    "Upgrade lên gói hàng tháng bất kỳ lúc nào",
  ],
  en: [
    "10 AI videos — pay once, keep forever",
    "12-month validity from purchase date",
    "No monthly fees",
    "Auto video delivery after payment",
    "Dashboard credit balance tracking",
    "Upgrade to a monthly plan any time",
  ],
};

/** Produce a localized error message for a checkout API failure. */
function errorMessageFor(
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
  // 500, 503, or any other
  return lang === "vi"
    ? `Hệ thống đang gặp sự cố. Thử lại sau${serverError ? ` (${serverError})` : ""}`
    : `System error. Please try again later${serverError ? ` (${serverError})` : ""}`;
}

/** Read pending purchase from sessionStorage; returns null if expired or absent. */
function readPendingPurchase(): PendingPurchase | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPurchase
    if (Date.now() - parsed.createdAt > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Store pending purchase in sessionStorage. */
function writePendingPurchase(paymentUrl: string, skuId: string): void {
  try {
    const data: PendingPurchase = { paymentUrl, skuId, createdAt: Date.now() }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(data))
  } catch {
    // sessionStorage not available (SSR, private mode) — non-fatal
  }
}

/** Clear pending purchase from sessionStorage. */
function clearPendingPurchase(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // non-fatal
  }
}

export function OneTimeBundleCard({
  sku = STARTER,
  userId,
  heygenHealthy = true,
}: OneTimeBundleCardProps) {
  const locale = useLocale() as "vi" | "en";
  const lang: "vi" | "en" = locale === "vi" ? "vi" : "en";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);

  const label = lang === "vi" ? sku.label_vi : sku.label_en;
  const features = FEATURES[lang];

  // P0.5: On mount, check for unexpired pending purchase in sessionStorage
  useEffect(() => {
    setPendingPurchase(readPendingPurchase())
  }, []);

  const handleBuy = async () => {
    if (loading || !heygenHealthy) return;

    // P0.5: If there's a pending purchase for this SKU, redirect to it instead
    const existing = readPendingPurchase()
    if (existing && existing.skuId === sku.id) {
      window.location.href = existing.paymentUrl
      return
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/one-time-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId: sku.id, userId }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as { error?: string };
        setError(errorMessageFor(res.status, errorBody.error, lang));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        // P0.5: Store pending purchase before redirecting
        writePendingPurchase(data.url, sku.id)
        window.location.href = data.url;
      }
    } catch {
      setError(
        lang === "vi"
          ? "Không thể kết nối. Kiểm tra kết nối mạng và thử lại"
          : "Network error. Check your connection and try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearPending = () => {
    clearPendingPurchase()
    setPendingPurchase(null)
  }

  const title_vi = "Gói Mua Lẻ";
  const title_en = "One-Time Bundle";
  const description_vi = "Mua credits, dùng khi cần — không ràng buộc hàng tháng";
  const description_en = "Buy credits, use when needed — no monthly commitment";
  const badge_vi = "Trả một lần";
  const badge_en = "One-time";

  const isDisabled = loading || !heygenHealthy;

  const ctaLabel = () => {
    if (!heygenHealthy) {
      return lang === "vi"
        ? "Đang bảo trì hệ thống — vui lòng quay lại sau"
        : "Service temporarily unavailable — try again later";
    }
    if (loading) {
      return lang === "vi" ? "Đang xử lý..." : "Processing...";
    }
    return lang === "vi" ? "Mua ngay" : "Buy now";
  };

  return (
    <FadeInView
      duration={500}
      className="relative flex flex-col rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-8 transition-all duration-300 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-500/10"
    >
      {/* Badge */}
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-1 text-xs font-semibold text-emerald-300">
        {lang === "vi" ? badge_vi : badge_en}
      </span>

      <h3 className="text-xl font-bold text-foreground">
        {lang === "vi" ? title_vi : title_en}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "vi" ? description_vi : description_en}
      </p>

      {/* Price */}
      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-emerald-400">
            ${sku.priceUsd}
          </span>
          <span className="text-muted-foreground">USD</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "vi"
            ? `${sku.credits} video · Hiệu lực ${sku.ttlMonths} tháng`
            : `${sku.credits} videos · ${sku.ttlMonths}-month validity`}
        </p>
      </div>

      {/* Features */}
      <div className="mt-6 flex-1">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
          <span aria-hidden="true">&#x1F4E6;</span>
          {label}
        </p>
        <ul className="space-y-2">
          {features.map((f) => (
            <FeatureItem key={f} text={f} />
          ))}
        </ul>
      </div>

      {/* P0.5: Pending purchase banner */}
      {pendingPurchase && pendingPurchase.skuId === sku.id && (
        <div
          role="status"
          className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          <p className="font-semibold">
            {lang === "vi"
              ? "Bạn có giao dịch chưa hoàn thành"
              : "You have a pending purchase"}
          </p>
          <p className="mt-1 text-xs text-amber-400/80">
            {lang === "vi"
              ? "Hoàn tất thanh toán hoặc hủy để mua mới."
              : "Complete payment or cancel to start a new one."}
          </p>
          <div className="mt-2 flex gap-2">
            <a
              href={pendingPurchase.paymentUrl}
              className="rounded bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
            >
              {lang === "vi" ? "Tiếp tục thanh toán" : "Continue payment"}
            </a>
            <button
              onClick={handleClearPending}
              className="rounded bg-transparent px-3 py-1 text-xs text-amber-400/60 hover:text-amber-400"
            >
              {lang === "vi" ? "Hủy & mua mới" : "Cancel & buy new"}
            </button>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleBuy}
        disabled={isDisabled}
        aria-label={lang === "vi" ? `Mua ${label}` : `Buy ${label}`}
        className="mt-8 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-white transition-all duration-300 hover:bg-emerald-400 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ctaLabel()}
      </button>

      {/* Error message */}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400"
        >
          {error}
          {/* Login link for 401 errors */}
          {error.includes("đăng nhập") || error.includes("log in") ? (
            <a
              href={`/${locale}/login?redirect=/${locale}/pricing`}
              className="ml-1 underline hover:text-red-300"
            >
              {lang === "vi" ? "Đăng nhập" : "Login"}
            </a>
          ) : null}
        </p>
      )}
    </FadeInView>
  );
}
