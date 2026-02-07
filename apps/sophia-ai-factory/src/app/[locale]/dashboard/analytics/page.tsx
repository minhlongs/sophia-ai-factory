import React from "react";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { Campaign } from "@/types";
import { AnalyticsView } from "./components/analytics-view";
import { getTranslations } from 'next-intl/server';

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

  if (session?.user) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      campaigns = data as Campaign[];
    }
  } else if (process.env.NODE_ENV === "development") {
    // Fallback for dev without auth
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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

      <AnalyticsView campaigns={campaigns} />
    </div>
  );
}
