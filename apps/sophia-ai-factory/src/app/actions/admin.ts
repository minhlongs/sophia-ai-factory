"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTierAccess } from "@/lib/tier-gate";
import { Tier } from "@/types";

export interface AdminActivity {
  id: string;
  action: string;
  user: string;
  time: string;
}

export interface AdminStats {
  totalScripts: number;
  totalVideos: number;
  publishedVideos: number;
  activeUsers: number;
  revenue: number;
  recentActivity: AdminActivity[];
}

export async function getAdminStats(): Promise<AdminStats> {
  // 1. Real auth check via Supabase session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Admin access required");
  }

  const rawTier = user.user_metadata?.tier;
  const userTier: Tier = (typeof rawTier === "string" && ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"].includes(rawTier))
    ? (rawTier as Tier)
    : "BASIC";

  try {
    verifyTierAccess(userTier, "enable_admin_dashboard");
  } catch {
    throw new Error("Unauthorized: Admin access required");
  }

  // 2. Fetch Real Stats using Admin Client (to bypass RLS for global analytics)
  const adminSupabase = await createAdminClient();

  // Parallel queries for performance
  const [
    { count: totalScripts },
    { count: totalVideos },
    { count: publishedVideos },
    activeUsersResult,
    { data: payments },
    { data: recentCampaigns }
  ] = await Promise.all([
    adminSupabase.from("campaigns").select("*", { count: "exact", head: true }),
    adminSupabase.from("campaigns").select("*", { count: "exact", head: true }).not("video_url", "is", null),
    adminSupabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "completed"),
    adminSupabase.from("campaigns").select("user_id"),
    adminSupabase.from("payment_events").select("payload").eq("processed", true),
    adminSupabase.from("campaigns")
      .select("id, title, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const activeUsersData = activeUsersResult?.data as { user_id: string }[] | null;
  const recentCampaignsTyped = recentCampaigns as { id: string; title: string; created_at: string; user_id: string }[] | null;

  // Calculate unique active users
  const uniqueUsers = new Set(activeUsersData?.map(c => c.user_id) || []);

  // Calculate revenue from payment payloads (Polar.sh format)
  const totalRevenue = ((payments as any[]) || []).reduce((sum, p) => {
    // Type checking for the JSON payload
    const payload = p.payload as { data?: { amount?: number } } | null;
    const amount = payload?.data?.amount || 0;
    return sum + amount;
  }, 0);

  // Map recent activity
  const recentActivity: AdminActivity[] = (recentCampaignsTyped || []).map(c => ({
    id: c.id,
    action: "Campaign Created",
    user: c.user_id.substring(0, 8) + "...",
    time: new Date(c.created_at).toLocaleString()
  }));

  return {
    totalScripts: totalScripts || 0,
    totalVideos: totalVideos || 0,
    publishedVideos: publishedVideos || 0,
    activeUsers: uniqueUsers.size,
    revenue: totalRevenue,
    recentActivity
  };
}
