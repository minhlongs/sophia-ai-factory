"use client";

import { useTranslations } from "next-intl";
import type { BillingPeriod } from "./types";

interface BillingIntervalSwitchProps {
  billingPeriod: BillingPeriod;
  onPeriodChange: (period: BillingPeriod) => void;
}

export function BillingIntervalSwitch({
  billingPeriod,
  onPeriodChange,
}: BillingIntervalSwitchProps) {
  const t = useTranslations("landing");

  return (
    <div role="group" aria-label={t("pricing.billing_cycle_aria_label")}>
      <div className="mt-6 flex justify-center">
        <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 gap-1 shadow-[0_0_15px_rgba(139,92,246,0.12)]">
          <button
            type="button"
            role="switch"
            aria-checked={billingPeriod === "monthly"}
            onClick={() => onPeriodChange("monthly")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              billingPeriod === "monthly"
                ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow shadow-violet-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pricing.monthly_label")}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={billingPeriod === "annual"}
            onClick={() => onPeriodChange("annual")}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              billingPeriod === "annual"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow shadow-emerald-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pricing.annual_label")}
            <span className="ml-2 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
              {t("pricing.save_percent", { percent: 17 })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
