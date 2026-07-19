/**
 * Landing Page Types — TypeScript interfaces and Zod schemas for programmatic SEO.
 *
 * @module seed/types/landing-page-types
 */

import { z } from 'zod';

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

// ── Zod Schemas ─────────────────────────────────────────────────────────────────

export const FeatureSchema = z.object({
  icon: z.string(),
  title_en: z.string(),
  title_vi: z.string(),
  desc_en: z.string(),
  desc_vi: z.string(),
});

export const FaqItemSchema = z.object({
  question_en: z.string(),
  question_vi: z.string(),
  answer_en: z.string(),
  answer_vi: z.string(),
});

export const GeneratedLandingContentSchema = z.object({
  heroTitleEn: z.string(),
  heroTitleVi: z.string(),
  heroSubEn: z.string(),
  heroSubVi: z.string(),
  features: z.array(FeatureSchema).min(3).max(6),
  faq: z.array(FaqItemSchema).min(3).max(5),
  metaTitleEn: z.string(),
  metaTitleVi: z.string(),
  metaDescEn: z.string(),
  metaDescVi: z.string(),
});

export const CreateLandingPageInputSchema = z.object({
  id: z.string().min(1).max(100),
  nicheLabel: z.string().min(1).max(200),
  heroTitleEn: z.string().optional(),
  heroTitleVi: z.string().optional(),
  heroSubEn: z.string().optional(),
  heroSubVi: z.string().optional(),
  features: z.array(FeatureSchema).optional(),
  faq: z.array(FaqItemSchema).optional(),
  metaTitleEn: z.string().optional(),
  metaTitleVi: z.string().optional(),
  metaDescEn: z.string().optional(),
  metaDescVi: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const UpdateLandingPageInputSchema = z.object({
  nicheLabel: z.string().min(1).max(200).optional(),
  heroTitleEn: z.string().optional(),
  heroTitleVi: z.string().optional(),
  heroSubEn: z.string().optional(),
  heroSubVi: z.string().optional(),
  features: z.array(FeatureSchema).optional(),
  faq: z.array(FaqItemSchema).optional(),
  metaTitleEn: z.string().optional(),
  metaTitleVi: z.string().optional(),
  metaDescEn: z.string().optional(),
  metaDescVi: z.string().optional(),
  isPublished: z.boolean().optional(),
});
