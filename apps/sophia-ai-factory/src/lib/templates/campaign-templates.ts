/**
 * Campaign Template System
 * Predefined templates for common campaign types
 */

export type CampaignTone = "professional" | "casual" | "urgent" | "friendly" | "enthusiastic";
export type CampaignCategory = "welcome" | "product" | "seasonal" | "promotion" | "viral";

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: CampaignCategory;
  icon: string; // Emoji or icon identifier
  is_predefined?: boolean;
  defaults: {
    title: string;
    audience: string;
    tone: CampaignTone;
    suggestedDuration: number; // in seconds
    keywords: string[];
  };
}

/**
 * Predefined campaign templates
 */
export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Campaign",
    description: "Onboard new subscribers with a warm introduction to your brand",
    category: "welcome",
    icon: "👋",
    is_predefined: true,
    defaults: {
      title: "Welcome to [Your Brand]",
      audience: "New subscribers and customers",
      tone: "friendly",
      suggestedDuration: 20,
      keywords: ["welcome", "introduction", "getting started", "onboarding"]
    }
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Announce and showcase your new product with excitement",
    category: "product",
    icon: "🚀",
    is_predefined: true,
    defaults: {
      title: "Introducing [Product Name]",
      audience: "Existing customers and product enthusiasts",
      tone: "enthusiastic",
      suggestedDuration: 25,
      keywords: ["new product", "launch", "innovation", "features"]
    }
  },
  {
    id: "seasonal",
    name: "Seasonal Campaign",
    description: "Leverage seasonal events and holidays for timely content",
    category: "seasonal",
    icon: "🎉",
    is_predefined: true,
    defaults: {
      title: "Special [Season/Holiday] Offer",
      audience: "All customers",
      tone: "enthusiastic",
      suggestedDuration: 20,
      keywords: ["seasonal", "limited time", "holiday", "celebration"]
    }
  },
  {
    id: "flash-sale",
    name: "Flash Sale",
    description: "Create urgency with time-sensitive promotional offers",
    category: "promotion",
    icon: "⚡",
    is_predefined: true,
    defaults: {
      title: "Flash Sale: [Discount]% Off!",
      audience: "Active customers and deal seekers",
      tone: "urgent",
      suggestedDuration: 15,
      keywords: ["flash sale", "limited time", "urgent", "discount"]
    }
  },
  {
    id: "viral-content",
    name: "Viral Content",
    description: "Craft shareable content designed for maximum engagement",
    category: "viral",
    icon: "🔥",
    is_predefined: true,
    defaults: {
      title: "You Won't Believe This!",
      audience: "Social media followers and viral content consumers",
      tone: "casual",
      suggestedDuration: 15,
      keywords: ["viral", "trending", "must-see", "share-worthy"]
    }
  }
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: CampaignCategory): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter(t => t.category === category);
}

/**
 * Apply template defaults to campaign data while allowing customization
 */
export function applyTemplateDefaults(
  template: CampaignTemplate,
  customizations?: Partial<CampaignTemplate['defaults']>
): CampaignTemplate['defaults'] {
  return {
    ...template.defaults,
    ...customizations
  };
}
