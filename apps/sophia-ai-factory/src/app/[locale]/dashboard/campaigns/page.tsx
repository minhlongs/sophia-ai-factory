import { createServerClient } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { redirect } from "next/navigation";
import { logger } from "@/seed/utils/logger-utility";
import dynamic from "next/dynamic";
import { Button } from "@/seed/components/ui/button";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { EmptyState } from "@/seed/components/ui/empty-state";
import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { Campaign } from "@/seed/types";
import { getTranslations } from 'next-intl/server';

const CampaignList = dynamic(
  () => import("../components/campaign-list").then(m => ({ default: m.CampaignList })),
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

export default async function CampaignsPage() {
  const t = await getTranslations('dashboard');
  const tEmpty = await getTranslations('dashboard.emptyState.campaigns');
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let campaigns: Campaign[] = [];

  if (user) {
    try {
      const db = createServerClient();
      const { data, error } = await db
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        logger.error("[campaigns/page] DB error", new Error(error.message));
      }
      campaigns = (data as unknown as Campaign[]) || [];
    } catch (e) {
      logger.error("[campaigns/page] Failed to fetch campaigns", e instanceof Error ? e : new Error(String(e)));
      campaigns = [];
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('sidebar.campaigns')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/create">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" aria-hidden="true" />
              {t('buttons.new_campaign')}
            </Button>
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={tEmpty('title')}
          description={tEmpty('description')}
          cta={{ label: tEmpty('cta'), href: '/dashboard/create' }}
        />
      ) : (
        <CampaignList initialCampaigns={campaigns} />
      )}
    </div>
  );
}
