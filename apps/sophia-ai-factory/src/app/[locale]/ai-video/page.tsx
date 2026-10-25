/**
 * AI Video Hub Page — Spatial Bento 2027 & Dual-Read AEO/GEO Index for all 51 Niches.
 * Route: /[locale]/ai-video
 * @module app/[locale]/ai-video/page
 */

import type { Metadata } from 'next';
import { Link } from '@/navigation';
import { NICHE_SLUGS } from '@/seed/config/niche-list';
import { buildNicheHubPayload } from '@/seed/aeo';
import { normalizeAeoLocale } from '@/tree/aeo';
import { DualReadPageSection } from '@/forest/components/aeo';
import { ArrowRight, Video, Search } from 'lucide-react';
import { getNicheCard } from './niche-card-helpers';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? `Video AI Cho ${NICHE_SLUGS.length} Ngành Nghề | Sophia AI Factory`
      : `AI Video for ${NICHE_SLUGS.length} Industries | Sophia AI Factory`,
    description: isVi
      ? `Tạo video AI chuyên nghiệp tự động cho ${NICHE_SLUGS.length} ngành nghề. Bất động sản, thương mại điện tử, tiền mã hóa, giáo dục, nhà hàng, và nhiều hơn nữa.`
      : `Create automated professional AI videos across ${NICHE_SLUGS.length} industries. Real estate, e-commerce, crypto, education, restaurants, and more.`,
    alternates: {
      languages: { en: '/en/ai-video', vi: '/vi/ai-video' },
      canonical: `/${locale}/ai-video`,
    },
  };
}

export const dynamicParams = false;

export default async function AiVideoHubPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const aeoPayload = buildNicheHubPayload(normalizeAeoLocale(locale));
  const niches = NICHE_SLUGS.map((slug) => getNicheCard(slug, isVi));

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Spatial Hero */}
      <section className="relative overflow-hidden py-16 lg:py-20 border-b border-border/60">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <Video className="h-4 w-4" />
            {isVi ? `${NICHE_SLUGS.length} Ngành Nghề Tự Động Hóa` : `${NICHE_SLUGS.length} Automated Verticals`}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5">
            {isVi ? 'Video AI Cho Mọi Ngành Nghề' : 'AI Video for Every Industry'}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {isVi
              ? 'Khám phá cách Sophia AI Factory tự động tạo kịch bản, giọng đọc, avatar và gắn link tiếp thị liên kết cho ngành của bạn.'
              : 'Discover how Sophia AI Factory automates scripts, voiceovers, avatars, and affiliate monetization for your industry.'}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-7 py-3.5 rounded-full text-base font-semibold transition shadow-lg"
          >
            {isVi ? 'Bắt Đầu Ngay' : 'Start Now'}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Dual-Read AEO/GEO Citation & Comparison Matrix */}
      <DualReadPageSection payload={aeoPayload} />

      {/* 51 Niche Spatial Bento Grid */}
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-3 mb-8">
            <Search className="h-6 w-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {isVi ? `Chọn Ngành Của Bạn (${NICHE_SLUGS.length} Ngách)` : `Choose Your Industry (${NICHE_SLUGS.length} Verticals)`}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {niches.map((niche) => (
              <Link
                key={niche.slug}
                href={`/ai-video/${niche.slug}`}
                className="spatial-bento-card group flex flex-col items-center gap-2 p-4 md:p-5 text-center"
              >
                <span className="text-3xl" role="img" aria-hidden="true">
                  {niche.emoji}
                </span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {niche.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
