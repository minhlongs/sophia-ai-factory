/**
 * Types & constants for MarketplaceStitchSection
 */

export interface MarketplaceTemplate {
  id: string;
  templateId: string;
  name: string;
  category: string;
  priceCents: number;
  tags: string[];
  totalSales: number;
  totalRevenueCents: number;
  ratingAvg: number;
  ratingCount: number;
  publishedAt: string;
  previewMd: string | null;
  demoVideoUrl: string | null;
  authorUserId: string | null;
  authorBrandName?: string | null;
  authorLogoUrl?: string | null;
}

export type SortKey = "popular" | "rating" | "newest";

export interface MarketplaceStitchSectionProps {
  initialTemplates?: MarketplaceTemplate[];
  initialCategory?: string;
  fetchUrl?: string;
}

export const AMBER = "#D97706";

export function extractCategories(templates: MarketplaceTemplate[]): string[] {
  const seen = new Set<string>();
  for (const t of templates) {
    if (t.category) seen.add(t.category);
  }
  return Array.from(seen).sort();
}
