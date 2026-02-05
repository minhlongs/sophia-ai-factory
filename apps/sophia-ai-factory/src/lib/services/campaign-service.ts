import { supabase } from "@/lib/supabase/client";
import { Campaign } from "@/types";

export const campaignService = {
  async getCampaigns(userId: string) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Campaign[];
  },

  async getCampaign(id: string) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Campaign;
  }
};
