"use client";

const USD_TO_VND_DISPLAY = 25500;

export interface CheckoutDisplayValues {
  finalPriceCents: number;
  originalPriceFormatted: string;
  finalPriceFormatted: string;
  qrCodeSrc: string;
  vndFormatted: string;
}

export function computeCheckoutDisplayValues(params: {
  priceCents: number;
  discountedPriceCents?: number;
  checkoutUrl?: string;
  locale: string;
}): CheckoutDisplayValues {
  const { priceCents, discountedPriceCents, checkoutUrl, locale } = params;
  const finalPriceCents = discountedPriceCents !== undefined ? discountedPriceCents : priceCents;
  const numberLocale = locale === "vi" ? "vi-VN" : "en-US";

  const originalPriceFormatted = new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(priceCents / 100);

  const finalPriceFormatted = new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(finalPriceCents / 100);

  const qrCodeSrc = checkoutUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutUrl)}`
    : "";

  const vndAmount = Math.round(((finalPriceCents / 100) * USD_TO_VND_DISPLAY) / 1000) * 1000;
  const vndFormatted = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(vndAmount);

  return {
    finalPriceCents,
    originalPriceFormatted,
    finalPriceFormatted,
    qrCodeSrc,
    vndFormatted,
  };
}

export async function verifyCheckoutOrderStatus(
  orderId: string,
): Promise<"pending" | "completed" | "failed" | null> {
  try {
    const res = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(orderId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { status: string };
    if (data.status === "completed") return "completed";
    if (data.status === "failed" || data.status === "expired") return "failed";
    return "pending";
  } catch {
    return null;
  }
}
