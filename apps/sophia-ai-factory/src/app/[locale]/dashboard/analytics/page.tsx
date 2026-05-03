import React from "react";
import dynamic from "next/dynamic";
import { getD1Client } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserTier } from "@/seed/db/get-user-tier";
import { checkAdmin, canAccessRevenue } from "@/lib/analytics/rbac";
import { Campaign, Tier } from "@/seed/types";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { getTranslations } from 'next-intl/server';
import { redirect } from "next/navigation";
import type { RevenueSnapshot } from "@/seed/types/analytics-revenue";

// ── Dynamic imports ──────────────────────────────────────────────────────────

const AnalyticsDashboardClient = dynamic(
  () => import("./components/analytics-dashboard-client").then(m => ({ default: m.AnalyticsDashboardClient })),
  {
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

// AnalyticsView is passed as a prop to preserve existing behaviour
const AnalyticsView = dynamic(
  () => import("./components/analytics-view").then(m => ({ default: m.AnalyticsView }))
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
  const [userTier, isAdmin]: [Tier, boolean] = await Promise.all([
    getUserTier(user.id),
    checkAdmin(user.id),
  ]);
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <AnalyticsDashboardClient
        campaigns={campaigns}
        userTier={userTier}
        userId={userId}
        isAdmin={isAdmin}
        initialRevenue={initialRevenue}
        AnalyticsViewComponent={AnalyticsView}
      />
    </div>
  );
}
