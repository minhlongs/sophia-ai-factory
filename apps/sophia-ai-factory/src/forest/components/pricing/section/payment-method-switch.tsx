"use client";

import { useTranslations } from "next-intl";
import type { PaymentMethod } from "./types";

interface PaymentMethodSwitchProps {
  paymentMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}

export function PaymentMethodSwitch({
  paymentMethod,
  onMethodChange,
}: PaymentMethodSwitchProps) {
  const t = useTranslations("landing");

  return (
    <div role="group" aria-label={t("pricing.payment_method_aria_label")}>
      <div className="mt-6 flex justify-center">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 gap-1 shadow-[0_0_15px_rgba(139,92,246,0.12)]">
          <button
            type="button"
            onClick={() => onMethodChange("nowpayments")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              paymentMethod === "nowpayments"
                ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow shadow-violet-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden="true">💎</span> {t("pricing.crypto_label")}
          </button>
          <button
            type="button"
            onClick={() => onMethodChange("payos")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              paymentMethod === "payos"
                ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow shadow-amber-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden="true">🏦</span> {t("pricing.payos_label")}
          </button>
        </div>
      </div>
      {paymentMethod === "payos" ? (
        <p className="mt-2 text-center text-xs text-amber-400/70">
          {t("pricing.payos_desc")}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-primary-400/70">
          {t("pricing.crypto_desc")}
        </p>
      )}
    </div>
  );
}
