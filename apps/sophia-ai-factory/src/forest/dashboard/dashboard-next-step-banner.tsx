"use client";

/**
 * One Next Step banner for the primary dashboard.
 *
 * The dashboard is the operator's desk, so it opens with exactly one action that
 * matches the customer's real state. The step is derived from verified server
 * signals only — readiness and counts already fetched by the dashboard route —
 * so the banner never invents work that does not exist, and never claims a
 * number the server did not report.
 *
 * @module forest/dashboard/dashboard-next-step-banner
 */

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { ArrowRight, ClipboardList, Megaphone, Search, Settings } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import type { SystemReadiness } from "@/tree/readiness/readiness-checker";
import type { DashboardData } from "./types";

export type NextStepKind = "setup" | "offer" | "campaign" | "approvals";

export interface DashboardNextStepBannerProps {
  readiness?: SystemReadiness | null;
  initialData?: DashboardData;
  className?: string;
}

export interface NextStep {
  kind: NextStepKind;
  href: string;
  eyebrowKey: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

const ICONS = {
  setup: Settings,
  offer: Search,
  campaign: Megaphone,
  approvals: ClipboardList,
} as const;

/**
 * Count campaigns that are still awaiting the customer's decision.
 *
 * A null/undefined count means the server did not report activity, which is not
 * the same as zero: the caller treats it as unknown and falls back to the
 * offer step rather than telling the customer there is nothing to approve.
 */
export function countApprovalBacklog(initialData?: DashboardData): number | null {
  if (!initialData) return null;
  const activities = initialData.recentActivities;
  if (!activities) return null;

  const backlog = activities.filter((activity) => activity.status === "pending");
  return backlog.length;
}

/**
 * Choose the single next step from verified signals, in journey order.
 *
 * @returns the step, or null when no signal was reported at all — the caller
 *          hides the banner rather than guessing at the customer's state.
 */
export function resolveNextStep(
  readiness: SystemReadiness | null | undefined,
  initialData?: DashboardData,
): NextStep | null {
  // Nothing verified: no readiness and no dashboard data. Sending the customer
  // to "track your campaigns" here would be an invented state.
  if (!readiness && !initialData) return null;

  const hasProviders = Boolean(readiness?.providersConfigured?.length);

  if (readiness && !readiness.readyForMissions && !hasProviders) {
    return {
      kind: "setup",
      href: "/setup",
      eyebrowKey: "steps.setup.eyebrow",
      titleKey: "steps.setup.title",
      bodyKey: "steps.setup.body",
      ctaKey: "steps.setup.cta",
      icon: ICONS.setup,
    };
  }

  const campaignCount = initialData?.campaignMetrics?.totalCampaigns;
  const hasVerifiedCampaignCount = typeof campaignCount === "number";
  if (hasVerifiedCampaignCount && campaignCount === 0) {
    return {
      kind: "offer",
      href: "/dashboard/affiliates",
      eyebrowKey: "steps.offer.eyebrow",
      titleKey: "steps.offer.title",
      bodyKey: "steps.offer.body",
      ctaKey: "steps.offer.cta",
      icon: ICONS.offer,
    };
  }

  const approvalBacklog = countApprovalBacklog(initialData);
  if (approvalBacklog !== null && approvalBacklog > 0) {
    return {
      kind: "approvals",
      href: "/dashboard/approvals",
      eyebrowKey: "steps.approvals.eyebrow",
      titleKey: "steps.approvals.title",
      bodyKey: "steps.approvals.body",
      ctaKey: "steps.approvals.cta",
      icon: ICONS.approvals,
    };
  }

  // "Track the campaigns you approved" is a claim, so it needs proof of at
  // least one campaign. Without that proof the banner stays hidden.
  if (!hasVerifiedCampaignCount || campaignCount < 1) return null;

  return {
    kind: "campaign",
    href: "/dashboard/campaigns",
    eyebrowKey: "steps.campaign.eyebrow",
    titleKey: "steps.campaign.title",
    bodyKey: "steps.campaign.body",
    ctaKey: "steps.campaign.cta",
    icon: ICONS.campaign,
  };
}

export function DashboardNextStepBanner({
  readiness,
  initialData,
  className,
}: DashboardNextStepBannerProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("stitch.dashboard.nextStep");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  const step = resolveNextStep(readiness, initialData);
  // No verified signals at all: stay silent instead of guessing a state.
  if (!step) return null;

  const Icon = step.icon;

  return (
    <div
      data-testid="dashboard-next-step-banner"
      data-step={step.kind}
      className={cn(
        "p-4 sm:p-5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center gap-4",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        <div className="space-y-0.5 min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
            {t(step.eyebrowKey)}
          </span>
          <h3 className="text-sm font-bold text-foreground dark:text-white tracking-tight">
            {t(step.titleKey)}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{t(step.bodyKey)}</p>
        </div>
      </div>
      <Link
        href={step.href}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm transition-all shrink-0 self-start sm:self-auto"
      >
        <span>{t(step.ctaKey)}</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
