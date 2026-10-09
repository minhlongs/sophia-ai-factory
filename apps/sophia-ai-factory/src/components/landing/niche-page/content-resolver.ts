import { getBySlug } from '@/seed/db/repositories/landing-pages-repo';
import { generateLandingPageContent } from '@/tree/landing/llm-fallback-generator';
import { NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import type { PageContent } from './types';

/**
 * Niche Landing Content Resolver
 *
 * Resolves content via D1 pre-compiled records or falls back to LLM generation.
 *
 * @module components/landing/niche-page/content-resolver
 */

export async function resolveNicheContent(
  niche: string,
  isVi: boolean,
): Promise<PageContent> {
  const d1Page = await getBySlug(niche);

  if (d1Page) {
    return {
      heroTitle: (isVi ? d1Page.heroTitleVi : d1Page.heroTitleEn) ?? d1Page.nicheLabel,
      heroSub: (isVi ? d1Page.heroSubVi : d1Page.heroSubEn) ?? '',
      features: d1Page.features.map((f) => ({
        icon: f.icon,
        title: isVi ? f.title_vi : f.title_en,
        desc: isVi ? f.desc_vi : f.desc_en,
      })),
      faq: d1Page.faq.map((f) => ({
        question: isVi ? f.question_vi : f.question_en,
        answer: isVi ? f.answer_vi : f.answer_en,
      })),
      nicheLabel: d1Page.nicheLabel,
    };
  }

  // Try LLM fallback with admin BYOK key
  const apiKey = await resolveUserApiKey(
    null,
    'openrouter',
    process.env.OPENROUTER_API_KEY,
  );

  const generated = await generateLandingPageContent(niche, apiKey ?? undefined);
  const label = NICHE_LABELS[niche as NicheSlug];
  const nicheLabel = label
    ? `${label.en} / ${label.vi}`
    : niche.replace(/-/g, ' ');

  return {
    heroTitle: isVi ? generated.heroTitleVi : generated.heroTitleEn,
    heroSub: isVi ? generated.heroSubVi : generated.heroSubEn,
    features: generated.features.map((f) => ({
      icon: f.icon,
      title: isVi ? f.title_vi : f.title_en,
      desc: isVi ? f.desc_vi : f.desc_en,
    })),
    faq: generated.faq.map((f) => ({
      question: isVi ? f.question_vi : f.question_en,
      answer: isVi ? f.answer_vi : f.answer_en,
    })),
    nicheLabel,
  };
}
