"use client";

import { OPTION_A_PILOT_COPY } from '@/seed/config/tiers/option-a-pilot-contract';
import { useTranslations, useLocale } from "next-intl";
import { Check } from "lucide-react";

export function RefundPolicyBanner() {
  const t = useTranslations("landing");
  const pilotCopy = OPTION_A_PILOT_COPY[useLocale() === 'vi' ? 'vi' : 'en'];

  return (
    <div className="mt-8 mx-auto max-w-xl rounded-2xl border border-border bg-gradient-to-r from-violet-950/20 via-violet-900/10 to-cyan-950/20 p-4 text-center shadow-lg backdrop-blur-sm">
      <p className="flex items-center justify-center gap-2 text-xs md:text-sm text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check className="h-3 w-3" />
        </span>
        <span className="font-semibold text-foreground">{t("pricing.refund_master_title")}</span>{" "}
        {t("pricing.refund_master_desc")}
      </p>
      <p className="text-sm text-muted-foreground">{pilotCopy.scope}</p>
      <p className="text-sm text-muted-foreground">{pilotCopy.refund}</p>
    </div>
  );
}
