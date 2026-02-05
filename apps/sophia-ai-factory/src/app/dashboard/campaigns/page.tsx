import { createServerClient } from "@/lib/supabase/server";
import { CampaignList } from "../components/campaign-list";
import { Button } from "@/app/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Campaign } from "@/types";

export default async function CampaignsPage() {
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500">Monitor and manage your video generation campaigns</p>
        </div>
        <Link href="/dashboard/create">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <CampaignList initialCampaigns={campaigns} />
    </div>
  );
}
