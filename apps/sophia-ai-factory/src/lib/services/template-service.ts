import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/types";
import { CampaignTemplate, CAMPAIGN_TEMPLATES, CampaignCategory } from "@/lib/templates/campaign-templates";

// Initialize client for server-side usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const templateService = {
  /**
   * Get all available templates (predefined + user custom)
   */
  async getTemplates(userId?: string): Promise<CampaignTemplate[]> {
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    let data: Database['public']['Tables']['campaign_templates']['Row'][] | null = null;
    let error = null;

    if (userId) {
      const result = await supabase
        .from("campaign_templates")
        .select("*")
        .or(`is_predefined.eq.true,user_id.eq.${userId}`);
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("campaign_templates")
        .select("*")
        .eq("is_predefined", true);
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error fetching templates:", error);
      return CAMPAIGN_TEMPLATES;
    }

    if (!data) {
        return CAMPAIGN_TEMPLATES;
    }

    // Transform DB records to CampaignTemplate type
    return data.map((record) => ({
      id: record.id,
      name: record.name,
      description: record.description,
      category: record.category as CampaignCategory,
      icon: record.icon || "📝",
      is_predefined: record.is_predefined,
      defaults: record.defaults as CampaignTemplate['defaults']
    }));
  },

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<CampaignTemplate | null> {
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("campaign_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      // Fallback to static lookup
      return CAMPAIGN_TEMPLATES.find(t => t.id === id) || null;
    }

    const record = data;

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      category: record.category as CampaignCategory,
      icon: record.icon || "📝",
      is_predefined: record.is_predefined,
      defaults: record.defaults as CampaignTemplate['defaults']
    };
  }
};
