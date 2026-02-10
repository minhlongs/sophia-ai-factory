import React from "react";
import dynamic from "next/dynamic";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Campaign, Tier } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from 'next-intl/server';

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
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let campaigns: Campaign[] = [];
  let userTier: Tier = "BASIC";

  if (session?.user) {
    // Get user tier from metadata
    const tier = session.user.user_metadata?.tier;
    if (tier === "PREMIUM" || tier === "ENTERPRISE" || tier === "MASTER") {
      userTier = tier;
    }

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      campaigns = data as Campaign[];
    }
  } else if (process.env.NODE_ENV === "development") {
    // Fallback for dev without auth
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

     if (!error && data) {
      campaigns = data as Campaign[];
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <AnalyticsView campaigns={campaigns} userTier={userTier} />
    </div>
  );
}
