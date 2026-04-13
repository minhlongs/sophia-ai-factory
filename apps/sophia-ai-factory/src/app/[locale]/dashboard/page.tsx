import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createServerClient } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/db/auth";
import { DashboardStats } from "./components/dashboard-stats";
import { OnboardingWelcomeBanner } from "./components/onboarding-welcome-banner";
import { CrossSellBanner } from "@/components/dashboard/cross-sell-banner";
import { Campaign } from "@/types";
import { getTranslations } from 'next-intl/server';
import { cookies } from "next/headers";

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
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const user = await getCurrentUser(cookieHeader);

  let campaigns: Campaign[] = [];

  if (user?.id) {
    try {
      const db = createServerClient();
      const { data } = await db
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      campaigns = (data as Campaign[]) || [];
    } catch {
      // D1 campaigns table may not exist yet — show empty dashboard
      campaigns = [];
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
