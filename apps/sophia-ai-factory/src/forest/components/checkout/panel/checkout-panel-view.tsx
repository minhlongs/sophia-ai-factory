"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { CheckoutPanelProps } from "./types";
import { PricingSummary } from "./pricing-summary";
import { PaymentQrSection } from "./payment-methods";
import {
  CheckoutPanelHeader,
  CheckoutPanelFooter,
} from "./checkout-panel-chrome";
import {
  computeCheckoutDisplayValues,
  verifyCheckoutOrderStatus,
} from "./checkout-panel-formatters";

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

  const {
    originalPriceFormatted,
    finalPriceFormatted,
    qrCodeSrc,
    vndFormatted,
  } = computeCheckoutDisplayValues({
    priceCents,
    discountedPriceCents,
    checkoutUrl,
    locale,
  });

  const handleVerifyStatus = async () => {
    if (!orderId) return;
    setChecking(true);
    try {
      const nextStatus = await verifyCheckoutOrderStatus(orderId);
      if (nextStatus) {
        setPaymentStatus(nextStatus);
        if (nextStatus === "completed") {
          setTimeout(() => {
            window.location.href = `/${locale}/payment-success?tier=${tier}&order_id=${orderId}`;
          }, 1500);
        }
      }
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
        <CheckoutPanelHeader onClose={onClose} />

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

        <CheckoutPanelFooter orderId={orderId} />
      </div>
    </div>
  );
}
