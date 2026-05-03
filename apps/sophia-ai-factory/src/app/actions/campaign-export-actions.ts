"use server";

import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { createServerClient } from "@/seed/db/client";
import { Campaign } from "@/seed/types";
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
  const user = await getCurrentUser();

  if (!user?.id) {
    return { success: false, message: "Unauthorized" };
  }

  const db = createServerClient();
  let query = db
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("created_at", `${filters.endDate}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, message: "Failed to fetch campaigns" };
  }

  const campaigns = data as unknown as Campaign[];

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
