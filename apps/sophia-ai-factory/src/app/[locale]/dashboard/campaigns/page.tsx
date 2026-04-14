import { createServerClient } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/better-auth-session";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Campaign } from "@/types";
import { CampaignExportControl } from "../components/campaign-export-control";
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

async function getAuthUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function CampaignsPage() {
  const t = await getTranslations('dashboard');
  const userId = await getAuthUserId();

  let campaigns: Campaign[] = [];

  if (userId) {
    try {
      const db = createServerClient();
      const { data } = await db
        .from("campaigns")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      campaigns = (data as Campaign[]) || [];
    } catch {
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
          <CampaignExportControl />
          <Link href="/dashboard/create">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('buttons.new_campaign')}
            </Button>
          </Link>
        </div>
      </div>

      <CampaignList initialCampaigns={campaigns} />
    </div>
  );
}
