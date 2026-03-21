/**
 * Affiliate partner links for Sophia AI Factory
 *
 * These are tools recommended to agency clients during onboarding.
 * Sophia earns commission when clients sign up through these links.
 *
 * Commission rates are indicative — verify with each partner program.
 */

export interface PartnerLink {
  /** Unique identifier for tracking */
  id: string;
  /** Display name */
  name: string;
  /** Short description shown in onboarding */
  description: string;
  /** Affiliate URL with tracking params */
  url: string;
  /** Estimated recurring commission rate (0–1) */
  commission_rate: number;
  /** Category for grouping in UI */
  category: 'video' | 'crm' | 'design' | 'marketing' | 'productivity';
  /** Whether to show prominently in onboarding */
  featured: boolean;
}

export const PARTNER_LINKS: PartnerLink[] = [
  {
    id: 'heygen',
    name: 'HeyGen',
    description: 'AI video generation — create talking-head videos from text in minutes.',
    // Replace AFFILIATE_ID with actual HeyGen affiliate code
    url: 'https://www.heygen.com/?ref=AFFILIATE_ID',
    commission_rate: 0.30, // 30% recurring per HeyGen affiliate program
    category: 'video',
    featured: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Free CRM to manage leads, deals, and follow-ups for your agency.',
    url: 'https://www.hubspot.com/?ref=sophia-ai',
    commission_rate: 0.20,
    category: 'crm',
    featured: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'All-in-one workspace for docs, wikis, and project tracking.',
    url: 'https://affiliate.notion.so/sophia',
    commission_rate: 0.20,
    category: 'productivity',
    featured: false,
  },
  {
    id: 'canva',
    name: 'Canva Pro',
    description: 'Design proposals, presentations, and social content with ease.',
    url: 'https://www.canva.com/join/sophia-ai',
    commission_rate: 0.15,
    category: 'design',
    featured: false,
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    description: 'Sales intelligence — find and contact your ideal agency prospects.',
    url: 'https://www.apollo.io/?ref=sophia',
    commission_rate: 0.20,
    category: 'marketing',
    featured: true,
  },
];

/**
 * Get featured partner links for onboarding flow
 */
export function getFeaturedPartners(): PartnerLink[] {
  return PARTNER_LINKS.filter((p) => p.featured);
}

/**
 * Get partner links by category
 */
export function getPartnersByCategory(category: PartnerLink['category']): PartnerLink[] {
  return PARTNER_LINKS.filter((p) => p.category === category);
}

/**
 * Get a single partner link by ID
 */
export function getPartnerById(id: string): PartnerLink | undefined {
  return PARTNER_LINKS.find((p) => p.id === id);
}
