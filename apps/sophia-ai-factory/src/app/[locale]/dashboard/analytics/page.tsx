import React from "react";
import dynamic from "next/dynamic";
import { getD1Client } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserTier } from "@/seed/db/get-user-tier";
import { checkAdmin, canAccessRevenue } from "@/lib/analytics/rbac";
import { Campaign, Tier } from "@/seed/types";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { TierGateCard } from "@/seed/components/ui/tier-gate-card";
import { getTranslations } from 'next-intl/server';
import { redirect } from "next/navigation";
import type { RevenueSnapshot } from "@/seed/types/analytics-revenue";
import { RouteHelpTooltip } from "@/components/help/route-help-tooltip";
import { headers } from "next/headers";
import { logger } from "@/seed/utils/logger-utility";
import { toError } from "@/seed/utils/to-error";

// ── Dynamic imports ──────────────────────────────────────────────────────────

const AnalyticsDashboardClient = dynamic(
  () => import("./components/analytics-dashboard-client").then(m => ({ default: m.AnalyticsDashboardClient })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[380px] rounded-xl" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
      </div>
    ),
  }
);

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata = {
  title: "Analytics | Sophia AI",
  description: "Campaign performance statistics and metrics",
};

// ── Revenue prefetch ──────────────────────────────────────────────────────────

async function fetchInitialRevenue(
  userId: string,
  userTier: Tier,
  isAdmin: boolean,
): Promise<RevenueSnapshot | null> {
  if (!canAccessRevenue(userTier, isAdmin)) return null;

  try {
    const { fetchRevenueSnapshot } = await import('@/lib/analytics/queries/revenue-nowpayments');
    return await fetchRevenueSnapshot('30d', undefined);
  } catch {
    return null;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const t = await getTranslations('dashboard.analytics');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  let campaigns: Campaign[] = [];
  let userTier: Tier = 'BASIC';
  let isAdmin = false;
  let loadError: string | undefined;
  try {
    [userTier, isAdmin] = await Promise.all([
      getUserTier(user.id),
      checkAdmin(user.id),
    ]);
  } catch (err) {
    loadError = toError(err).message;
    logger.error('[Analytics] Failed to load tier/admin', toError(err));
    // Defaults: BASIC tier + not admin — page still renders
  }
  const userId = user.id;

  try {
    const db = await getD1Client();
    const { data } = await db
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) campaigns = data as unknown as Campaign[];
  } catch {
    campaigns = [];
  }

  const initialRevenue = await fetchInitialRevenue(userId, userTier, isAdmin);
  const hasRevenueAccess = canAccessRevenue(userTier, isAdmin);

  const hdrs = await headers();
  const acceptLang = hdrs.get('accept-language') ?? '';
  const locale = acceptLang.startsWith('vi') ? 'vi' : 'en';

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <RouteHelpTooltip locale={locale} routeKey="analytics" />
        </div>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
        >
          {t('loadErrorBanner')}
        </div>
      )}

      <AnalyticsDashboardClient
        campaigns={campaigns}
        userTier={userTier}
        userId={userId}
        isAdmin={isAdmin}
        initialRevenue={initialRevenue}
      />

      {/* Revenue section gate: show upsell when non-ENTERPRISE/MASTER */}
      {!hasRevenueAccess && (
        <TierGateCard
          requiredTier="ENTERPRISE"
          currentTier={userTier}
          featureName={t('gateTitle')}
        >
          {null}
        </TierGateCard>
      )}
    </div>
  );
}
