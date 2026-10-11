import type { SolutionIndustry } from '@/seed/config/solutions-catalog';

export interface PageProps {
  params: Promise<{
    locale: string;
    'use-case'?: string;
    useCase?: string;
  }>;
}

export interface SolutionHeroProps {
  industry: SolutionIndustry;
  locale: string;
  checkoutUrl: string;
  telegramUrl: string;
}

export interface SolutionFeaturesProps {
  industry: SolutionIndustry;
  locale: string;
}
