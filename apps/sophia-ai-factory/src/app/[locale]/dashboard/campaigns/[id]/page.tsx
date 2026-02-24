import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Campaign } from "@/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranslations, getFormatter } from 'next-intl/server';
import { CampaignHeader } from "./components/campaign-header";
import { CampaignDetailsSidebar } from "./components/campaign-details-sidebar";
import { CampaignScriptView } from "./components/campaign-script-view";

const VideoPreview = dynamic(
  () => import("@/components/video-preview").then(m => ({ default: m.VideoPreview })),
  {
    loading: () => (
      <div className="w-full max-w-2xl mx-auto">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="aspect-video w-full rounded-lg" />
      </div>
    ),
  }
);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('campaign.detail');
  const tStatus = await getTranslations('campaign.status');
  const format = await getFormatter();
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  let campaign: Campaign | null = null;

  if (session?.user) {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();
    campaign = data ? (data as unknown as Campaign) : null;
  } else if (process.env.NODE_ENV === 'development') {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();
    campaign = data ? (data as unknown as Campaign) : null;
  } else {
    redirect("/login");
  }

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <CampaignHeader campaign={campaign} t={t} tStatus={tStatus} format={format} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border shadow-sm p-1">
             <VideoPreview
               videoUrl={campaign.video_url}
               thumbnailUrl={campaign.thumbnail_url}
               status={campaign.status}
               progress={campaign.progress || 0}
               errorMessage={campaign.error_message}
               campaignId={campaign.id}
             />
          </div>

          <CampaignScriptView campaign={campaign} t={t} />
        </div>

        <CampaignDetailsSidebar campaign={campaign} t={t} tStatus={tStatus} format={format} />
      </div>
    </div>
  );
}
