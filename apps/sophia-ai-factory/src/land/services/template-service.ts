import { CampaignTemplate, CAMPAIGN_TEMPLATES } from "@/land/templates/campaign-templates";

export const templateService = {
  /**
   * Get all available templates (predefined + user custom)
   */
  async getTemplates(_userId?: string): Promise<CampaignTemplate[]> {
    // Return static predefined templates — D1 campaign_templates table
    // is optional and or() filter is not supported by D1 query builder.
    return CAMPAIGN_TEMPLATES;
  },

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<CampaignTemplate | null> {
    return CAMPAIGN_TEMPLATES.find(t => t.id === id) || null;
  }
};
