/**
 * Campaign Dashboard page — server component.
 * Fetches campaigns and renders the client-side interactive dashboard.
 */

import { createServerClient } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { redirect } from "next/navigation";
import { logger } from "@/seed/utils/logger-utility";
import { CampaignsClientWrapper } from "../components/campaigns-client-wrapper";
import { Campaign } from "@/seed/types";

// Campaigns are user-specific but update infrequently — ISR with 60s revalidate
export const revalidate = 60;

export default async function CampaignsPage() {
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

  return <CampaignsClientWrapper initialCampaigns={campaigns} />;
}
