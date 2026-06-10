"use client";

import React, { useState, useEffect } from "react";
import { Check, ShieldAlert, ShieldCheck, Loader2, X, Globe, Lock, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { CryptoPaymentExplainer } from "./crypto-payment-explainer";

interface CheckoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tier: string;
  priceCents: number;
  discountedPriceCents?: number;
  period: "monthly" | "yearly" | "lifetime";
  paymentMethod: "nowpayments" | "payos";
  couponCode?: string;
  checkoutUrl?: string;
  orderId?: string;
  locale: string;
}

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
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
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
          {/* Order Details & Summary */}
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

            {/* Trust and Policy */}
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

            {/* USDT Explainer integration */}
            {paymentMethod === "nowpayments" && (
              <div className="mt-4">
                <CryptoPaymentExplainer />
              </div>
            )}

            {/* Direct Pay Link */}
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

          {/* Payment & QR Scanner Area */}
          <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8 text-center space-y-4">
            {checkoutUrl ? (
              <>
                <div className="relative group">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 opacity-20 blur group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative rounded-xl border border-border bg-muted p-3 shadow-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeSrc}
                      alt="Payment QR Code"
                      className="h-[180px] w-[180px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold">{t("scan_qr")}</p>
                  <p className="text-[11px] text-muted-foreground px-4">
                    {paymentMethod === "nowpayments"
                      ? t("qr_nowpayments")
                      : t("qr_payos")}
                  </p>
                </div>

                {/* Verification Action */}
                <div className="w-full pt-2">
                  <button
                    onClick={handleVerifyStatus}
                    disabled={checking}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 py-2.5 text-xs font-semibold hover:bg-muted/50 transition disabled:opacity-50"
                  >
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
                    ) : paymentStatus === "completed" ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    ) : paymentStatus === "failed" ? (
                      <ShieldAlert className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Globe className="h-4 w-4 text-accent-400" />
                    )}
                    {checking
                      ? t("verifying")
                      : paymentStatus === "completed"
                        ? t("payment_success")
                        : paymentStatus === "failed"
                          ? t("payment_failed")
                          : t("verify_status")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-2 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                <p className="text-xs text-muted-foreground">{t("initializing")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer badges */}
        <div className="mt-8 border-t border-border pt-4 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            <span>{t("ssl_secured")}</span>
          </div>
          {orderId && (
            <span>
              ID: {orderId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
