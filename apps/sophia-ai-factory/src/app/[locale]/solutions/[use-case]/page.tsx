/**
 * Programmatic SEO Solutions Landing Page
 *
 * Route: /[locale]/solutions/[use-case]
 * - Pre-rendered at build time via generateStaticParams for sub-second TTFB on Cloudflare Workers edge
 * - Multi-entity Schema.org JSON-LD (SoftwareApplication + Product + FAQPage + BreadcrumbList)
 * - Tailored bilingual high-converting copy, pain points, ROI calculator, testimonials, and FAQs
 *
 * @module app/[locale]/solutions/[use-case]/page
 */

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
import {
  Sparkles,
  ArrowRight,
  Send,
  CheckCircle2,
  AlertTriangle,
  Quote,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface PageProps {
  params: Promise<{
    locale: string;
    'use-case'?: string;
    useCase?: string;
  }>;
}

export const dynamicParams = true;

/**
 * Prerender all 20+ primary industries and known niches for both en and vi locales.
 */
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

/**
 * Generate localized metadata, OpenGraph, and hreflang alternates.
 */
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

export default async function SolutionPage({ params }: PageProps) {
  const resolved = await params;
  const rawSlug = resolved['use-case'] || resolved.useCase;
  if (!rawSlug) notFound();

  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';
  const industry = getSolutionIndustry(rawSlug);

  // Generate multi-entity Schema.org JSON-LD
  const schema = buildSolutionsMultiEntitySchema({
    industry,
    locale,
    baseUrl: SITE_URL,
  });

  const telegramUrl = `https://t.me/Sophia_Bbot?start=sol_${industry.slug}`;
  const checkoutUrl = `/checkout?plan=starter&promo=SOLO100`;

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 border-b border-zinc-800/80">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
            {/* Industry Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-emerald-400 mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isVi ? `Giải Pháp Dành Riêng Cho: ${industry.nameVi}` : `Tailored for: ${industry.nameEn}`}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-4xl mx-auto">
              {isVi ? industry.heroHeadlineVi : industry.heroHeadlineEn}
            </h1>

            {/* Subheadline */}
            <p className="mt-5 text-base sm:text-lg text-zinc-300 max-w-3xl mx-auto leading-relaxed">
              {isVi ? industry.heroSubheadlineVi : industry.heroSubheadlineEn}
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={checkoutUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition hover:scale-105"
              >
                <span>{isVi ? 'Đăng ký ngay (-$100 với SOLO100)' : 'Claim $100 OFF with SOLO100'}</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold border border-zinc-700 transition"
              >
                <Send className="w-4 h-4 text-sky-400" />
                <span>{isVi ? 'Xem demo trên Telegram' : 'Test Free Telegram Demo'}</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isVi ? 'Xuất video 1080p sau 60s' : 'Sub-60s 1080p generation'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isVi ? 'Tự động đa kênh TikTok, YouTube, X' : 'TikTok, YouTube Shorts, X automated'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isVi ? 'Thanh toán USDT & VietQR' : 'USDT & VietQR supported'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Content Container */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-20">
          {/* Pain Points vs Solution Grid */}
          <section>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {isVi ? 'Thách Thức Cốt Lõi' : 'Industry Bottlenecks'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isVi
                  ? `3 Rào Cản Khi Làm Video Ngành ${industry.nameVi}`
                  : `Top 3 Video Obstacles Facing ${industry.nameEn}`}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2">
                {isVi
                  ? 'Tại sao hầu hết doanh nghiệp bỏ cuộc trước khi đạt được lượng khách hàng mong muốn.'
                  : 'Why traditional video approaches fail to generate consistent high-margin leads.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {industry.painPoints.map((pain, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-sm mb-4 border border-rose-500/20">
                      0{idx + 1}
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">
                      {isVi ? pain.titleVi : pain.titleEn}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {isVi ? pain.descVi : pain.descEn}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>{isVi ? 'Sophia giải quyết tự động' : 'Solved by Sophia AI'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonial Quote Section */}
          <section className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 via-zinc-900/50 to-zinc-900/80 p-8 sm:p-10 relative overflow-hidden">
            <Quote className="absolute right-6 bottom-4 w-28 h-28 text-zinc-800/30 pointer-events-none" />
            <div className="max-w-3xl relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{industry.testimonial.metrics}</span>
              </div>
              <blockquote className="text-lg sm:text-xl font-medium text-white italic leading-relaxed">
                &ldquo;{isVi ? industry.testimonial.quoteVi : industry.testimonial.quoteEn}&rdquo;
              </blockquote>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center justify-center text-sm">
                  {industry.testimonial.author.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {industry.testimonial.author}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {isVi ? industry.testimonial.roleVi : industry.testimonial.roleEn} • {industry.testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Sections: Sample Prompt, ROI Calculator, FAQ, Conversion CTA */}
          <SolutionInteractiveSections industry={industry} locale={locale} />
        </div>
      </div>
    </>
  );
}
