"use server";

import { createServerClient } from "@/lib/supabase/server";
import { Campaign } from "@/types";
import { convertToCSV } from "@/lib/export-utils";

export type ExportFormat = "json" | "csv";

export interface ExportFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
}

export async function exportCampaigns(
  format: ExportFormat,
  filters: ExportFilters
) {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // In development, we might not have a session if using the fallback logic seen in other files.
  // However, for export, let's enforce auth or handle the dev fallback similar to campaigns.ts if needed.
  // Looking at campaigns.ts, it has a dev fallback. Let's replicate strict auth for now, as exports are usually protected.
  // If no user, we return unauthorized.

  const userId = session?.user?.id;

  if (!userId) {
     if (process.env.NODE_ENV === 'development') {
         // Dev fallback logic similar to campaigns.ts could go here if needed,
         // but strictly, exports should probably require a real user context or be skipped in pure dev without auth.
         // Let's stick to returning unauthorized for safety unless we really need it.
         // Actually, to make it testable in dev without auth setup, let's check if we can get a user from admin list like campaigns.ts
         // But for now, let's return error.
         return { success: false, message: "Unauthorized. Please sign in." };
     }
     return { success: false, message: "Unauthorized" };
  }

  let query = supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters.endDate) {
    // Append time to include the full end day
    query = query.lte("created_at", `${filters.endDate}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Export error:", error);
    return { success: false, message: "Failed to fetch campaigns" };
  }

  const campaigns = data as Campaign[];

  // Map to clean DTO
  const cleanData = campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    topic: c.topic || "",
    audience: c.audience || "",
    status: c.status,
    progress: c.progress,
    created_at: c.created_at,
    video_url: c.video_url || "",
  }));

  let content = "";
  let mimeType = "";
  let extension = "";

  if (format === "json") {
    content = JSON.stringify(cleanData, null, 2);
    mimeType = "application/json";
    extension = "json";
  } else {
    content = convertToCSV(cleanData);
    mimeType = "text/csv";
    extension = "csv";
  }

  return {
    success: true,
    data: content,
    filename: `campaigns_export_${new Date().toISOString().split("T")[0]}.${extension}`,
    mimeType,
  };
}
