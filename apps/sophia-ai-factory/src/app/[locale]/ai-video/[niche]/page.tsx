/**
 * AI Video for [Niche] Landing Page — SSG with LLM fallback.
 *
 * Route: /[locale]/ai-video/[niche]
 * @module app/[locale]/ai-video/[niche]/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

import type { PageParams } from '@/components/landing/niche-page/types';
import { resolveNicheContent } from '@/components/landing/niche-page/content-resolver';
import { HeroSection, FeaturesSection } from '@/components/landing/niche-page/landing-hero-features';
import { HowItWorksSection, PricingTeaserSection } from '@/components/landing/niche-page/landing-workflow-pricing';
import { FaqSection, CtaSection } from '@/components/landing/niche-page/landing-faq-cta';
import { buildNicheStaticParams, buildNicheMetadata } from './niche-seo-helpers';

export async function generateStaticParams(): Promise<PageParams[]> {
  return buildNicheStaticParams();
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; niche: string }>;
}): Promise<Metadata> {
  const { locale, niche } = await params;
  return buildNicheMetadata(locale, niche);
}

export default async function NicheLandingPage({
  params,
}: {
  params: Promise<{ locale: string; niche: string }>;
}) {
  const { locale, niche } = await params;
  const isVi = locale === 'vi';

  let content;
  try {
    content = await resolveNicheContent(niche, isVi);
  } catch (err) {
    logger.error('[LandingSSG] Failed to load content', {
      niche,
      locale,
      error: getErrorMessage(err),
    });
    notFound();
  }

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: content.heroTitle,
            description: content.heroSub,
            inLanguage: locale,
            about: { '@type': 'Thing', name: content.nicheLabel },
            publisher: {
              '@type': 'Organization',
              name: 'Sophia AI Factory',
              url: 'https://sophia.agencyos.network',
            },
          }).replace(/<\//g, '<\\/'),
        }}
      />

      <HeroSection
        title={content.heroTitle}
        subtitle={content.heroSub}
        ctaText={isVi ? 'Bắt Đầu Miễn Phí' : 'Start Free'}
        signupUrl="/signup"
      />

      <FeaturesSection
        features={content.features}
        title={isVi ? 'Tính Năng Chính' : 'Key Features'}
      />

      <HowItWorksSection isVi={isVi} />

      <PricingTeaserSection isVi={isVi} />

      {content.faq.length > 0 && (
        <FaqSection
          faq={content.faq}
          title={isVi ? 'Câu Hỏi Thường Gặp' : 'Frequently Asked Questions'}
        />
      )}

      <CtaSection
        nicheLabel={content.nicheLabel}
        isVi={isVi}
        signupUrl="/signup"
      />
    </main>
  );
}
