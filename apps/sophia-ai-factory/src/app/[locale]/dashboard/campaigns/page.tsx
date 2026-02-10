import { createServerClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
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

export default async function CampaignsPage() {
  const t = await getTranslations('dashboard');
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  // For MVP/Dev without full auth: fetch all campaigns via admin if no user
  // In production, we strictly use session.user.id
  let campaigns: Campaign[] = [];

  if (session?.user) {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    campaigns = data as Campaign[] || [];
  } else if (process.env.NODE_ENV === 'development') {
    // Dev fallback: fetch latest 20 campaigns
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
    campaigns = data as Campaign[] || [];
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
