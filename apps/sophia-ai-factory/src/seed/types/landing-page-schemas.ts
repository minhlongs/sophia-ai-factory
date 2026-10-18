/**
 * Landing Page Zod Validation Schemas for programmatic SEO.
 *
 * @module seed/types/landing-page-schemas
 */

import { z } from 'zod';

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
