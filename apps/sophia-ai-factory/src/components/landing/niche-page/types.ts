/**
 * Niche Landing Page Types
 *
 * @module components/landing/niche-page/types
 */

export interface PageParams {
  locale: string;
  niche: string;
}

export interface PageFeature {
  icon: string;
  title: string;
  desc: string;
}

export interface PageFaqItem {
  question: string;
  answer: string;
}

export interface PageContent {
  heroTitle: string;
  heroSub: string;
  features: PageFeature[];
  faq: PageFaqItem[];
  nicheLabel: string;
}
