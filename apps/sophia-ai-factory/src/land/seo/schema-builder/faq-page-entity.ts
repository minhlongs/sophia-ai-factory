import type { SolutionIndustry } from '@/seed/types/solutions-types';
import type { SchemaFaqPage, SchemaFaqQuestion } from './types';

/**
 * Builds the FAQPage entity schema for a specific industry solution.
 */
export function buildFaqPageEntity(
  industry: SolutionIndustry,
  locale: 'en' | 'vi',
  canonicalUrl: string,
): SchemaFaqPage {
  const isVi = locale === 'vi';
  const questions: SchemaFaqQuestion[] = industry.faqs.map((faq) => ({
    '@type': 'Question',
    name: isVi ? faq.questionVi : faq.questionEn,
    acceptedAnswer: {
      '@type': 'Answer',
      text: isVi ? faq.answerVi : faq.answerEn,
    },
  }));

  return {
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#faq`,
    mainEntity: questions,
  };
}
