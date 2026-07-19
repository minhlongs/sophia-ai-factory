"use client";

/**
 * Dismissible affiliate program CTA banner shown at top of dashboard content area.
 * Persists dismissed state in localStorage under key `affiliate_cta_dismissed`.
 * Uses the `affiliate` i18n namespace.
 * Links to /affiliate (authenticated affiliate dashboard & referral link).
 */

import { useState, useEffect } from "react";
import { TrendingUp, ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from '@/seed/navigation';

const DISMISSED_KEY = "affiliate_cta_dismissed";

export function AffiliateCTABanner() {
  const t = useTranslations("affiliate");

  // Tri-state: null = not yet read from localStorage (avoids hydration flash)
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      setVisible(dismissed !== "1");
    } catch {
      // localStorage unavailable (SSR guard / private browsing) — show banner
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore write failure
    }
    setVisible(false);
  }

  // Render nothing until localStorage is read (prevents hydration mismatch)
  if (visible !== true) return null;

  return (
    <div
      role="banner"
      aria-label={t("cta_banner_title")}
      className="relative w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-emerald-700/25 via-accent/20 to-emerald-700/25 border-b border-emerald-500/20 text-white"
    >
      {/* Left: icon + title */}
      <div className="flex items-center gap-2 shrink-0">
        <TrendingUp className="w-4 h-4 text-emerald-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-emerald-100">{t("cta_banner_title")}</p>
      </div>

      {/* Centre: description */}
      <p className="text-xs text-white/70 text-center sm:text-left">
        {t("cta_banner_description")}
      </p>

      {/* Right: CTA link + dismiss */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/affiliate"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 transition-colors text-xs font-medium text-emerald-300 whitespace-nowrap"
        >
          {t("cta_banner_cta")}
          <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          aria-label={t("cta_banner_dismiss")}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
