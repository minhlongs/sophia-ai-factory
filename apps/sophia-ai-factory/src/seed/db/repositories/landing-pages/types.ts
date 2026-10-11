import { logger } from '@/seed/utils/logger-utility';
import type {
  Feature,
  FaqItem,
  LandingPage,
} from '@/seed/types/landing-page-types';

export interface LandingPageRow {
  id: string;
  niche_label: string;
  hero_title_en: string | null;
  hero_title_vi: string | null;
  hero_sub_en: string | null;
  hero_sub_vi: string | null;
  features_json: string | null;
  faq_json: string | null;
  meta_title_en: string | null;
  meta_title_vi: string | null;
  meta_desc_en: string | null;
  meta_desc_vi: string | null;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export function parseLandingPage(row: LandingPageRow): LandingPage {
  let features: Feature[] = [];
  let faq: FaqItem[] = [];

  try {
    if (row.features_json) features = JSON.parse(row.features_json) as Feature[];
  } catch {
    logger.warn('[LandingPagesRepo] Failed to parse features_json', { id: row.id });
  }

  try {
    if (row.faq_json) faq = JSON.parse(row.faq_json) as FaqItem[];
  } catch {
    logger.warn('[LandingPagesRepo] Failed to parse faq_json', { id: row.id });
  }

  return {
    id: row.id,
    nicheLabel: row.niche_label,
    heroTitleEn: row.hero_title_en,
    heroTitleVi: row.hero_title_vi,
    heroSubEn: row.hero_sub_en,
    heroSubVi: row.hero_sub_vi,
    features,
    faq,
    metaTitleEn: row.meta_title_en,
    metaTitleVi: row.meta_title_vi,
    metaDescEn: row.meta_desc_en,
    metaDescVi: row.meta_desc_vi,
    isPublished: row.is_published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
