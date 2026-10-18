/**
 * Landing Page Types — TypeScript interfaces and Zod schemas for programmatic SEO.
 *
 * @module seed/types/landing-page-types
 */

export {
  FeatureSchema,
  FaqItemSchema,
  GeneratedLandingContentSchema,
  CreateLandingPageInputSchema,
  UpdateLandingPageInputSchema,
} from './landing-page-schemas';

// ── Interfaces ──────────────────────────────────────────────────────────────────

export interface Feature {
  icon: string;
  title_en: string;
  title_vi: string;
  desc_en: string;
  desc_vi: string;
}

export interface FaqItem {
  question_en: string;
  question_vi: string;
  answer_en: string;
  answer_vi: string;
}

export interface LandingPage {
  id: string;
  nicheLabel: string;
  heroTitleEn: string | null;
  heroTitleVi: string | null;
  heroSubEn: string | null;
  heroSubVi: string | null;
  features: Feature[];
  faq: FaqItem[];
  metaTitleEn: string | null;
  metaTitleVi: string | null;
  metaDescEn: string | null;
  metaDescVi: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLandingPageInput {
  id: string;
  nicheLabel: string;
  heroTitleEn?: string;
  heroTitleVi?: string;
  heroSubEn?: string;
  heroSubVi?: string;
  features?: Feature[];
  faq?: FaqItem[];
  metaTitleEn?: string;
  metaTitleVi?: string;
  metaDescEn?: string;
  metaDescVi?: string;
  isPublished?: boolean;
}

export interface UpdateLandingPageInput {
  nicheLabel?: string;
  heroTitleEn?: string;
  heroTitleVi?: string;
  heroSubEn?: string;
  heroSubVi?: string;
  features?: Feature[];
  faq?: FaqItem[];
  metaTitleEn?: string;
  metaTitleVi?: string;
  metaDescEn?: string;
  metaDescVi?: string;
  isPublished?: boolean;
}

/** LLM-generated content (without slug/isPublished/timestamps — those come from D1 or cache). */
export interface GeneratedLandingContent {
  heroTitleEn: string;
  heroTitleVi: string;
  heroSubEn: string;
  heroSubVi: string;
  features: Feature[];
  faq: FaqItem[];
  metaTitleEn: string;
  metaTitleVi: string;
  metaDescEn: string;
  metaDescVi: string;
}

/** Cached landing content stored in KV. */
export interface CachedLandingContent {
  content: GeneratedLandingContent;
  nicheLabel: string;
  generatedAt: number;
  ttl: number;
}
