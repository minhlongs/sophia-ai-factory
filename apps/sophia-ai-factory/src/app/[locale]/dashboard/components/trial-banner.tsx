"use client";

/**
 * Free trial countdown banner for BASIC tier users nearing trial expiry.
 * Only rendered when layout.tsx decides showTrialBanner === true.
 * Uses next-intl for all UI strings.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

interface TrialBannerProps {
  /** Unix timestamp (seconds) when trial ends */
  trialEndsAt: number;
}

export function TrialBanner({ trialEndsAt }: TrialBannerProps) {
  const t = useTranslations("dashboard.trialBanner");
  const locale = useLocale();
  const nowSec = Math.floor(Date.now() / 1000);

  const daysLeft = useMemo(() => {
    const diff = trialEndsAt - nowSec;
    if (diff <= 0) return 0;
    return Math.ceil(diff / 86400);
  }, [trialEndsAt, nowSec]);

  if (daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 1;

  const text = isUrgent
    ? t("title")
    : t("description", { count: daysLeft });

  return (
    <div
      className={`w-full px-4 py-2.5 text-center text-sm font-medium transition-colors ${
        isUrgent
          ? "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white"
          : "bg-gradient-to-r from-emerald-600/70 to-primary/70 text-white"
      }`}
    >
      <Link
        href={`/${locale}/pricing`}
        className="inline-flex items-center gap-2 hover:underline"
      >
        {isUrgent && <span aria-hidden="true">⚠️</span>}
        {!isUrgent && <span aria-hidden="true">⏳</span>}
        {text}
        <span>{t("cta")}</span>
      </Link>
    </div>
  );
}
