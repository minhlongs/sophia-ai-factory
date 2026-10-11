"use client";

import React, { useState, useEffect } from "react";
import { X, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CheckoutPanelProps } from "./types";
import { PricingSummary } from "./pricing-summary";
import { PaymentQrSection } from "./payment-methods";

export function CheckoutPanel({
  isOpen,
  onClose,
  tier,
  priceCents,
  discountedPriceCents,
  period,
  paymentMethod,
  couponCode,
  checkoutUrl,
  orderId,
  locale,
}: CheckoutPanelProps) {
  const t = useTranslations("checkoutPanel");
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "completed" | "failed" | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const finalPriceCents = discountedPriceCents !== undefined ? discountedPriceCents : priceCents;
  const originalPriceFormatted = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(priceCents / 100);

  const finalPriceFormatted = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(finalPriceCents / 100);

  const qrCodeSrc = checkoutUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutUrl)}`
    : "";

  const USD_TO_VND_DISPLAY = 25500;
  const vndAmount = Math.round(((finalPriceCents / 100) * USD_TO_VND_DISPLAY) / 1000) * 1000;
  const vndFormatted = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(vndAmount);

  const handleVerifyStatus = async () => {
    if (!orderId) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = (await res.json()) as { status: string };
        if (data.status === "completed") {
          setPaymentStatus("completed");
          setTimeout(() => {
            window.location.href = `/${locale}/payment-success?tier=${tier}&order_id=${orderId}`;
          }, 1500);
        } else if (data.status === "failed" || data.status === "expired") {
          setPaymentStatus("failed");
        } else {
          setPaymentStatus("pending");
        }
      }
    } catch {
      // Non-fatal network error
    } finally {
      setChecking(false);
    }
  };

  const periodLabel =
    period === "lifetime"
      ? t("billing_period_lifetime")
      : period === "yearly"
        ? t("billing_period_yearly")
        : t("billing_period_monthly");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-background to-card p-6 md:p-8 shadow-2xl shadow-violet-500/10 text-foreground animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/30 text-primary shadow-[0_0_15px_rgba(139,92,246,0.15)]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{t("secure_title")}</h2>
            <p className="text-xs text-muted-foreground">{t("secure_desc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8">
          <PricingSummary
            tier={tier}
            periodLabel={periodLabel}
            priceCents={priceCents}
            discountedPriceCents={discountedPriceCents}
            originalPriceFormatted={originalPriceFormatted}
            finalPriceFormatted={finalPriceFormatted}
            couponCode={couponCode}
            paymentMethod={paymentMethod}
            vndFormatted={vndFormatted}
            checkoutUrl={checkoutUrl}
          />
          <PaymentQrSection
            checkoutUrl={checkoutUrl}
            qrCodeSrc={qrCodeSrc}
            paymentMethod={paymentMethod}
            checking={checking}
            paymentStatus={paymentStatus}
            onVerifyStatus={handleVerifyStatus}
          />
        </div>

        <div className="mt-8 border-t border-border pt-4 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            <span>{t("ssl_secured")}</span>
          </div>
          {orderId && <span>ID: {orderId}</span>}
        </div>
      </div>
    </div>
  );
}
