import { createServerClient } from '@/lib/db/client';
import { Campaign } from "@/types";

export const campaignService = {
  async getCampaigns(userId: string) {
    const db = createServerClient();
    const { data, error } = await db
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as unknown as Campaign[];
  },

  async getCampaign(id: string) {
    const db = createServerClient();
    const { data, error } = await db
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as unknown as Campaign;
  }
};
