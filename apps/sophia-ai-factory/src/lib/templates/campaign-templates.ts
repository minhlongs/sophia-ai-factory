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
  },
  // Vietnam holiday templates
  {
    id: "tet-lunar-new-year",
    name: "Tết Nguyên Đán / Lunar New Year",
    description: "Chiến dịch Tết với không khí lễ hội, chúc mừng năm mới. / Festive Lunar New Year campaign with Vietnamese celebration themes.",
    category: "seasonal",
    icon: "🎊",
    is_predefined: true,
    defaults: {
      title: "Chúc Mừng Năm Mới — Happy New Year!",
      audience: "Khách hàng Việt Nam và toàn cầu / Vietnamese and global customers",
      tone: "enthusiastic",
      suggestedDuration: 20,
      keywords: ["tết", "năm mới", "xuân", "chúc mừng", "lunar new year", "spring festival"]
    }
  },
  {
    id: "trung-thu-mid-autumn",
    name: "Tết Trung Thu / Mid-Autumn Festival",
    description: "Chiến dịch gia đình dịp Trung Thu — bánh trung thu, đèn lồng, sum họp. / Family-themed Mid-Autumn campaign with mooncakes and lanterns.",
    category: "seasonal",
    icon: "🥮",
    is_predefined: true,
    defaults: {
      title: "Chúc Mừng Tết Trung Thu / Happy Mid-Autumn!",
      audience: "Gia đình Việt Nam / Vietnamese families",
      tone: "friendly",
      suggestedDuration: 20,
      keywords: ["trung thu", "bánh trung thu", "đèn lồng", "mid-autumn", "mooncake", "family"]
    }
  },
  {
    id: "quoc-khanh-national-day",
    name: "Quốc Khánh 2/9 / Vietnam National Day",
    description: "Chiến dịch Quốc Khánh 2 tháng 9 — tự hào dân tộc, tinh thần Việt Nam. / Patriotic campaign for Vietnam National Day (September 2).",
    category: "seasonal",
    icon: "🇻🇳",
    is_predefined: true,
    defaults: {
      title: "Chúc Mừng Quốc Khánh 2/9 — Vietnam National Day",
      audience: "Người Việt Nam trong và ngoài nước / Vietnamese at home and abroad",
      tone: "professional",
      suggestedDuration: 25,
      keywords: ["quốc khánh", "2/9", "độc lập", "việt nam", "national day", "independence"]
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
