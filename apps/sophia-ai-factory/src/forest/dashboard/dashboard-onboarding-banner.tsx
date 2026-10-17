"use client";

/**
 * Obsidian Cyber-Glass Dashboard Onboarding Banner
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Implements:
 * 1. Verified routes to /dashboard/setup and /dashboard/system-health
 * 2. Obsidian glass aesthetics (bg-[#12141F]/90 with electric indigo glow)
 * 3. Bilingual support via next-intl
 * 4. Backward compatible translation keys for tests (ready, healthCheck, title, cta)
 *
 * @module forest/dashboard/dashboard-onboarding-banner
 */

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Sparkles, ArrowRight, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import type { SystemReadiness } from "@/tree/readiness/readiness-checker";

export interface DashboardOnboardingBannerProps {
  readiness?: SystemReadiness | null;
  className?: string;
}

export function DashboardOnboardingBanner({
  readiness,
  className,
}: DashboardOnboardingBannerProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("stitch.dashboard.onboardingBanner");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  const isReady = Boolean(
    readiness?.readyForMissions && readiness?.providersConfigured.length
  );

  if (isReady) {
    return (
      <div
        className={cn(
          "mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between",
          className
        )}
        data-testid="onboarding-ready-banner"
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {t("ready")}
          </span>
        </div>
        <Link
          href="/dashboard/system-health"
          className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5 transition-colors"
        >
          <Activity className="w-4 h-4" />
          <span>{t("healthCheck")}</span>
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-6 p-5 sm:p-6 rounded-xl bg-card dark:bg-[#11131F] backdrop-blur-xl border border-border dark:border-white/[0.08] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
        className
      )}
      data-testid="onboarding-banner"
    >
      <div className="space-y-1.5 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 shadow-sm">
            <Sparkles className="w-3 h-3 mr-1" />
            Sophia Onboarding
          </span>
          {readiness && (
            <span className="text-xs font-mono text-muted-foreground font-medium">
              {readiness.providersConfigured.length} AI Providers Configured
            </span>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-bold text-foreground dark:text-white tracking-tight">
          {t("title")}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 self-start md:self-auto shrink-0">
        <Link
          href="/dashboard/system-health"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-foreground dark:text-slate-300 hover:text-foreground dark:hover:text-white bg-muted/60 dark:bg-white/[0.05] hover:bg-muted dark:hover:bg-white/[0.1] border border-border dark:border-white/[0.1] transition-all"
        >
          <Activity className="w-4 h-4 text-primary" />
          <span>{t("healthCheck")}</span>
        </Link>

        <Link
          href="/dashboard/setup"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm transition-all"
        >
          <span>{t("cta")}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
