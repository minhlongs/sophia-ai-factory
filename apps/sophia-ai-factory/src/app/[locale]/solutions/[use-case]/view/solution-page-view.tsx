import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getSolutionIndustry,
  getAllSolutionSlugs,
} from '@/seed/config/solutions-catalog';
import { NICHE_SLUGS } from '@/seed/config/niche-list';
import {
  buildSolutionsMultiEntitySchema,
  SITE_URL,
} from '@/land/seo/solutions-schema-builder';
import { SolutionInteractiveSections } from '@/forest/solutions/solution-interactive-sections';
import type { PageProps } from './types';
import { SolutionHero } from './solution-hero';
import { SolutionFeatures } from './solution-features';

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ locale: string; 'use-case': string }>> {
  const primarySlugs = getAllSolutionSlugs();
  const allSlugs = Array.from(new Set([...primarySlugs, ...NICHE_SLUGS]));

  const params: Array<{ locale: string; 'use-case': string }> = [];
  for (const slug of allSlugs) {
    params.push({ locale: 'en', 'use-case': slug });
    params.push({ locale: 'vi', 'use-case': slug });
  }

  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const rawSlug = resolved['use-case'] || resolved.useCase || '';
  if (!rawSlug) return {};

  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';
  const industry = getSolutionIndustry(rawSlug);

  const title = isVi
    ? `${industry.nameVi} — Giải Pháp Video AI Tự Động Tăng Trưởng Doanh Thu`
    : `${industry.nameEn} Video Automation Engine — Sophia AI Factory`;

  const description = isVi ? industry.heroSubheadlineVi : industry.heroSubheadlineEn;
  const canonicalUrl = `${SITE_URL}/${locale}/solutions/${industry.slug}`;

  return {
    title,
    description,
    keywords: isVi ? industry.keywordsVi : industry.keywordsEn,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${SITE_URL}/en/solutions/${industry.slug}`,
        vi: `${SITE_URL}/vi/solutions/${industry.slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Sophia AI Factory',
      type: 'website',
      locale: isVi ? 'vi_VN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export async function SolutionPage({ params }: PageProps) {
  const resolved = await params;
  const rawSlug = resolved['use-case'] || resolved.useCase;
  if (!rawSlug) notFound();

  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const industry = getSolutionIndustry(rawSlug);

  const schema = buildSolutionsMultiEntitySchema({
    industry,
    locale,
    baseUrl: SITE_URL,
  });

  const telegramUrl = `https://t.me/Sophia_Bbot?start=sol_${industry.slug}`;
  const checkoutUrl = `/checkout?plan=starter&promo=SOLO100`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <SolutionHero
          industry={industry}
          locale={locale}
          checkoutUrl={checkoutUrl}
          telegramUrl={telegramUrl}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-20">
          <SolutionFeatures industry={industry} locale={locale} />
          <SolutionInteractiveSections industry={industry} locale={locale} />
        </div>
      </div>
    </>
  );
}
