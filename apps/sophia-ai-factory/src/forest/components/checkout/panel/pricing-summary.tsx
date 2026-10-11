"use client";

import React from "react";
import { Check, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { CryptoPaymentExplainer } from "../crypto-payment-explainer";
import type { PricingSummaryProps } from "./types";

export function PricingSummary({
  tier,
  periodLabel,
  discountedPriceCents,
  originalPriceFormatted,
  finalPriceFormatted,
  couponCode,
  paymentMethod,
  vndFormatted,
  checkoutUrl,
}: PricingSummaryProps) {
  const t = useTranslations("checkoutPanel");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">{t("order_summary")}</h3>
        <div className="flex justify-between">
          <div>
            <p className="font-semibold text-foreground">{tier}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {t("billing_period", { period: periodLabel })}
            </p>
          </div>
          <div className="text-right">
            {discountedPriceCents !== undefined && (
              <p className="text-xs line-through text-muted-foreground/50">{originalPriceFormatted}</p>
            )}
            <p className="font-bold text-lg text-emerald-400">{finalPriceFormatted}</p>
          </div>
        </div>

        {couponCode && (
          <div className="flex justify-between items-center text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-300">
            <span className="font-semibold">🎟️ Coupon: {couponCode}</span>
            <span>{t("discount_applied")}</span>
          </div>
        )}

        {paymentMethod === "payos" && (
          <div className="border-t border-border pt-3 flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{t("vnd_conversion")}:</span>
            <span className="font-bold text-amber-400">{vndFormatted}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            {t("pricing.refund_master_title")}: {t("pricing.refund_master_desc")}
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{t("support_247")}</span>
        </div>
      </div>

      {paymentMethod === "nowpayments" && (
        <div className="mt-4">
          <CryptoPaymentExplainer />
        </div>
      )}

      {checkoutUrl && (
        <div className="pt-2">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 font-semibold text-white transition hover:from-violet-500 hover:to-cyan-400 shadow-lg shadow-violet-500/20 active:scale-[0.98]"
          >
            {t("go_to_payment")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
