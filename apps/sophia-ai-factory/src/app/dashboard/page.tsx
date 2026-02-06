import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { CampaignList } from "./components/campaign-list";
import { createClient } from "@supabase/supabase-js";
import { Campaign } from "@/types";

export default async function DashboardPage() {
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Manage your automated video campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pricing">
            <Button variant="outline" className="flex items-center gap-2">
              ⚡ Upgrade
            </Button>
          </Link>
          <Link href="/dashboard/create">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      <CampaignList initialCampaigns={campaigns} />
    </div>
  );
}
