import { createServerClient } from "@/lib/db/client";
import { CampaignTemplate, CAMPAIGN_TEMPLATES, CampaignCategory } from "@/lib/templates/campaign-templates";

export const templateService = {
  /**
   * Get all available templates (predefined + user custom)
   */
  async getTemplates(userId?: string): Promise<CampaignTemplate[]> {
    try {
      const db = createServerClient();

      let result;
      if (userId) {
        result = await db
          .from("campaign_templates")
          .select("*")
          .or(`is_predefined.eq.true,user_id.eq.${userId}`);
      } else {
        result = await db
          .from("campaign_templates")
          .select("*")
          .eq("is_predefined", true);
      }

      if (result.error || !result.data) {
        return CAMPAIGN_TEMPLATES;
      }

      const data = result.data as Record<string, unknown>[];

      return data.map((record) => ({
        id: record.id as string,
        name: record.name as string,
        description: record.description as string,
        category: record.category as CampaignCategory,
        icon: (record.icon as string) || "📝",
        is_predefined: record.is_predefined as boolean,
        defaults: record.defaults as CampaignTemplate['defaults']
      }));
    } catch {
      // D1 table may not exist — return static templates
      return CAMPAIGN_TEMPLATES;
    }
  },

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<CampaignTemplate | null> {
    try {
      const db = createServerClient();

      const { data, error } = await db
        .from("campaign_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return CAMPAIGN_TEMPLATES.find(t => t.id === id) || null;
      }

      const record = data as Record<string, unknown>;

      return {
        id: record.id as string,
        name: record.name as string,
        description: record.description as string,
        category: record.category as CampaignCategory,
        icon: (record.icon as string) || "📝",
        is_predefined: record.is_predefined as boolean,
        defaults: record.defaults as CampaignTemplate['defaults']
      };
    } catch {
      return CAMPAIGN_TEMPLATES.find(t => t.id === id) || null;
    }
  }
};
