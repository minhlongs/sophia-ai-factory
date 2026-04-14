import React from "react";
import dynamic from "next/dynamic";
import { getD1Client } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/better-auth-session";
import { getUserTier } from "@/lib/db/get-user-tier";
import { Campaign, Tier } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from 'next-intl/server';
import { redirect } from "next/navigation";

const AnalyticsView = dynamic(
  () => import("./components/analytics-view").then(m => ({ default: m.AnalyticsView })),
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

export const metadata = {
  title: "Analytics | Sophia AI",
  description: "Campaign performance statistics and metrics",
};

export default async function AnalyticsPage() {
  const t = await getTranslations('dashboard.analytics');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  let campaigns: Campaign[] = [];
  const userTier: Tier = await getUserTier(user.id);
  const userId = user.id;

  try {
    const db = await getD1Client();
    const { data } = await db
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) campaigns = data as Campaign[];
  } catch {
    campaigns = [];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <AnalyticsView campaigns={campaigns} userTier={userTier} userId={userId} />
    </div>
  );
}
