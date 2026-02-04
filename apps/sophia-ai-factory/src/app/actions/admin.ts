"use server";

import { verifyTierAccess } from "@/lib/tier-gate";
import { Tier } from "@/types";

// Mock User for Admin Access Check
const MOCK_ADMIN_USER = {
  id: "admin_user_001",
  tier: "ENTERPRISE" as Tier
};

export async function getAdminStats() {
  // 1. Gate Access
  try {
    verifyTierAccess(MOCK_ADMIN_USER.tier, "enable_admin_dashboard");
  } catch {
    throw new Error("Unauthorized: Admin access required");
  }

  // 2. Fetch Stats (Simulated aggregation since Airtable API is limited for aggregation without formulas)
  // In a real app, we'd use a dedicated stats endpoint or DB query

  // For now, we will just count records if list is available, or return mocks if empty
  // Since list methods are per-user usually, we might need a 'listAll' for admin.
  // Let's implement listAll in airtable.ts or just mock the numbers for the dashboard MVP

  return {
    totalScripts: 142,
    totalVideos: 89,
    publishedVideos: 56,
    activeUsers: 24,
    revenue: 125000000, // VND
    recentActivity: [
      { id: "1", action: "New User Signup", user: "minh@example.com", time: "2 mins ago" },
      { id: "2", action: "Video Published", user: "lan@agency.vn", time: "15 mins ago" },
      { id: "3", action: "Affiliate Link Click", user: "visitor_88", time: "1 hour ago" },
      { id: "4", action: "Script Generated", user: "content_team", time: "3 hours ago" },
    ]
  };
}
