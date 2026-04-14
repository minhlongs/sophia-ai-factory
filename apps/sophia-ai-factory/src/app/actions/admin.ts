"use server";

import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";

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
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    throw new Error("Unauthorized: Admin access required");
  }

  const db = createServerClient();

  // Parallel queries
  const [campaignsResult, completedResult, paymentsResult, recentResult] = await Promise.all([
    db.from("campaigns").select("id, user_id, video_url, status"),
    db.from("campaigns").select("id").eq("status", "completed"),
    db.from("payment_events").select("payload").eq("processed", 1),
    db.from("campaigns")
      .select("id, title, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const campaigns = (campaignsResult.data || []) as Record<string, string>[];
  const totalScripts = campaigns.length;
  const totalVideos = campaigns.filter(c => c.video_url).length;
  const publishedVideos = (completedResult.data || []).length;

  const uniqueUsers = new Set(campaigns.map(c => c.user_id));

  const payments = (paymentsResult.data || []) as Record<string, unknown>[];
  const totalRevenue = payments.reduce((sum, p) => {
    const payload = (typeof p.payload === 'string' ? JSON.parse(p.payload) : p.payload) as { data?: { amount?: number } } | null;
    return sum + (payload?.data?.amount || 0);
  }, 0);

  const recentCampaigns = (recentResult.data || []) as Record<string, string>[];
  const recentActivity: AdminActivity[] = recentCampaigns.map(c => ({
    id: c.id,
    action: "Campaign Created",
    user: (c.user_id || "").substring(0, 8) + "...",
    time: new Date(c.created_at).toLocaleString(),
  }));

  return {
    totalScripts,
    totalVideos,
    publishedVideos,
    activeUsers: uniqueUsers.size,
    revenue: totalRevenue,
    recentActivity,
  };
}
