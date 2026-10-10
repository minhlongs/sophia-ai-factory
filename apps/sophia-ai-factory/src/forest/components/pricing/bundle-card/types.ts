/**
 * Types and schema for OneTimeBundleCard
 *
 * Layer: forest/components/pricing/bundle-card
 */

import type { OneTimeSku } from "@/seed/types";

export interface PendingPurchase {
  paymentUrl: string;
  createdAt: number;
  skuId: string;
}

export interface OneTimeBundleCardProps {
  /** Override SKU — defaults to STARTER_BUNDLE */
  sku?: OneTimeSku;
  /** User id for order_id in checkout URL */
  userId?: string;
  /** Whether HeyGen provider is currently healthy (from server-side pre-flight) */
  heygenHealthy?: boolean;
}

export const PENDING_KEY = "sophia_pending_purchase";
export const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const BUNDLE_FEATURES: Record<"vi" | "en", string[]> = {
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
