"use client";

import React from "react";
import Image from "next/image";
import { ShieldAlert, ShieldCheck, Loader2, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PaymentQrSectionProps } from "./types";

export function PaymentQrSection({
  checkoutUrl,
  qrCodeSrc,
  paymentMethod,
  checking,
  paymentStatus,
  onVerifyStatus,
}: PaymentQrSectionProps) {
  const t = useTranslations("checkoutPanel");

  return (
    <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8 text-center space-y-4">
      {checkoutUrl ? (
        <>
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 opacity-20 blur group-hover:opacity-30 transition duration-300" />
            <div className="relative rounded-xl border border-border bg-muted p-3 shadow-xl">
              <Image
                src={qrCodeSrc}
                alt="Payment QR Code"
                width={180}
                height={180}
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

          <div className="w-full pt-2">
            <button
              onClick={onVerifyStatus}
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
  );
}
