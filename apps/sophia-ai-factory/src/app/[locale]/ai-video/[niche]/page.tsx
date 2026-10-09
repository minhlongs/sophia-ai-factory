/**
 * AI Video for [Niche] Landing Page — SSG with LLM fallback.
 *
 * Route: /[locale]/ai-video/[niche]
 * - Build-time: generateStaticParams pre-builds all published D1 pages + NICHE_SLUGS
 * - Request-time (dynamicParams): unknown niches trigger LLM fallback → KV cache → serve
 * - Bilingual: VI+EN via locale param
 *
 * @module app/[locale]/ai-video/[niche]/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBySlug, getAllSlugs } from '@/seed/db/repositories/landing-pages-repo';
import { NICHE_SLUGS, NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

import type { PageParams } from '@/components/landing/niche-page/types';
import { resolveNicheContent } from '@/components/landing/niche-page/content-resolver';
import { HeroSection, FeaturesSection } from '@/components/landing/niche-page/landing-hero-features';
import { HowItWorksSection, PricingTeaserSection } from '@/components/landing/niche-page/landing-workflow-pricing';
import { FaqSection, CtaSection } from '@/components/landing/niche-page/landing-faq-cta';

export async function generateStaticParams(): Promise<PageParams[]> {
  try {
    const dbSlugs = await getAllSlugs();
    const allSlugs = [...new Set([...NICHE_SLUGS, ...dbSlugs])];

    const params: PageParams[] = [];
    for (const slug of allSlugs) {
      params.push({ locale: 'en', niche: slug });
      params.push({ locale: 'vi', niche: slug });
    }

    logger.info('[LandingSSG] generateStaticParams', {
      dbSlugsCount: dbSlugs.length,
      totalSlugs: allSlugs.length,
      totalPages: params.length,
    });

    return params;
  } catch (err) {
    logger.error('[LandingSSG] generateStaticParams failed', { error: getErrorMessage(err) });
    return NICHE_SLUGS.flatMap((slug) => [
      { locale: 'en', niche: slug },
      { locale: 'vi', niche: slug },
    ]);
  }
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; niche: string }>;
}): Promise<Metadata> {
  const { locale, niche } = await params;

  try {
    const page = await getBySlug(niche);

    if (page) {
      const title = locale === 'vi' ? page.metaTitleVi : page.metaTitleEn;
      const desc = locale === 'vi' ? page.metaDescVi : page.metaDescEn;

      return {
        title: title ?? page.nicheLabel,
        description: desc ?? '',
        openGraph: {
          title: title ?? page.nicheLabel,
          description: desc ?? '',
          type: 'article',
        },
        alternates: {
          languages: {
            en: `/en/ai-video/${niche}`,
            vi: `/vi/ai-video/${niche}`,
          },
          canonical: `/${locale}/ai-video/${niche}`,
        },
      };
    }
  } catch (err) {
    logger.warn('[LandingSSG] generateMetadata D1 lookup failed', {
      niche,
      error: getErrorMessage(err),
    });
  }

  const label = NICHE_LABELS[niche as NicheSlug];
  const nicheName = label
    ? (locale === 'vi' ? label.vi : label.en)
    : niche.replace(/-/g, ' ');

  return {
    title: locale === 'vi'
      ? `Video AI Cho ${nicheName} | Sophia AI Factory`
      : `AI Video for ${nicheName} | Sophia AI Factory`,
    description: locale === 'vi'
      ? `Tạo video ${nicheName.toLowerCase()} chuyên nghiệp bằng AI trong vài phút. Không cần kỹ năng quay phim hay chỉnh sửa.`
      : `Create professional AI-generated ${nicheName.toLowerCase()} videos in minutes. No filming or editing skills needed.`,
    alternates: {
      languages: {
        en: `/en/ai-video/${niche}`,
        vi: `/vi/ai-video/${niche}`,
      },
      canonical: `/${locale}/ai-video/${niche}`,
    },
  };
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
