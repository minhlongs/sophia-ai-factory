import { CampaignTemplate, CAMPAIGN_TEMPLATES } from "@/land/templates/campaign-templates";

export const templateService = {
  /**
   * Get all available templates (predefined + user custom).
   */
  async getTemplates(_userId?: string): Promise<CampaignTemplate[]> {
    return CAMPAIGN_TEMPLATES;
  },

  /**
   * Get template by ID.
   */
  async getTemplateById(id: string): Promise<CampaignTemplate | null> {
    return CAMPAIGN_TEMPLATES.find((t: CampaignTemplate) => t.id === id) || null;
  },

  /**
   * Get all available template categories.
   */
  async getCategories(): Promise<string[]> {
    return Array.from(new Set(CAMPAIGN_TEMPLATES.map((t: CampaignTemplate) => t.category)));
  },
};
