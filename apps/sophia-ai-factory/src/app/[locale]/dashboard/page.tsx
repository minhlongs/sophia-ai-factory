import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createServerClient } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/better-auth-session";
import { DashboardStats } from "./components/dashboard-stats";
import { OnboardingWelcomeBanner } from "./components/onboarding-welcome-banner";
import { CrossSellBanner } from "@/components/dashboard/cross-sell-banner";
import { Campaign } from "@/types";
import { getTranslations } from 'next-intl/server';

const CampaignList = dynamic(
  () => import("./components/campaign-list").then(m => ({ default: m.CampaignList })),
  {
    loading: () => (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    ),
  }
);

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const user = await getCurrentUser();

  let campaigns: Campaign[] = [];

  if (user?.id) {
    try {
      const db = createServerClient();
      const { data, error } = await db
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) console.error("[dashboard] DB error:", error.message);
      campaigns = (data as Campaign[]) || [];
    } catch (e) {
      console.error("[dashboard] Failed to fetch campaigns:", (e as Error).message);
      campaigns = [];
    }

    // First-login redirect: no campaigns and no API keys configured → setup wizard
    if (campaigns.length === 0) {
      try {
        const db = createServerClient();
        const { data: profile } = await db
          .from("user_profiles")
          .select("api_keys")
          .eq("user_id", user.id)
          .single();
        const apiKeys = profile?.api_keys as Record<string, unknown> | null | undefined;
        const hasApiKeys = apiKeys && Object.keys(apiKeys).length > 0;
        if (!hasApiKeys) {
          redirect("/setup-wizard");
        }
      } catch {
        // If profile fetch fails (new user, no row), redirect to setup wizard
        redirect("/setup-wizard");
      }
    }
  }

  // Calculate stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c =>
    c.status === 'processing_script' || c.status === 'processing_video' || c.status === 'queued'
  ).length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

  // Cross-sell: show RaaS banner if user has campaigns but no proposals used (Video user)
  const showRaasBanner = totalCampaigns > 0;

  return (
    <div className="space-y-8">
      <OnboardingWelcomeBanner />
      <CrossSellBanner variant={showRaasBanner ? "raas" : "video"} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pricing">
            <Button variant="outline" className="flex items-center gap-2">
              ⚡ {t('buttons.upgrade')}
            </Button>
          </Link>
          <Link href="/dashboard/create">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('buttons.new_campaign')}
            </Button>
          </Link>
        </div>
      </div>

      <DashboardStats
        totalCampaigns={totalCampaigns}
        activeCampaigns={activeCampaigns}
        completedCampaigns={completedCampaigns}
      />

      <CampaignList initialCampaigns={campaigns} />
    </div>
  );
}
