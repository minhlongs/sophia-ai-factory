import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { CampaignList } from "./components/campaign-list";
import { DashboardStats } from "./components/dashboard-stats";
import { OnboardingWelcomeBanner } from "./components/onboarding-welcome-banner";
import { createClient } from "@supabase/supabase-js";
import { Campaign } from "@/types";
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  let campaigns: Campaign[] = [];

  if (session?.user) {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    campaigns = data as Campaign[] || [];
  } else if (process.env.NODE_ENV === 'development') {
     // Fallback for dev
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
    campaigns = data as Campaign[] || [];
  }

  // Calculate stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c =>
    c.status === 'processing_script' || c.status === 'processing_video' || c.status === 'queued'
  ).length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

  return (
    <div className="space-y-8">
      <OnboardingWelcomeBanner />

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
