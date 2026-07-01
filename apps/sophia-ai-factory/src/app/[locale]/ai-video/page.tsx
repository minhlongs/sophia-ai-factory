/**
 * AI Video Hub Page — SEO index listing all niche landing pages.
 *
 * Route: /[locale]/ai-video
 * Lists all NICHE_SLUGS with bilingual labels, linking to each niche's dedicated page.
 * This page is indexed by search engines and serves as the top-of-funnel SEO hub.
 *
 * @module app/[locale]/ai-video/page
 */

import type { Metadata } from 'next';
import { Link } from '@/navigation';
import { NICHE_SLUGS, NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import { ArrowRight, Video, Search } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Video AI Cho Mọi Ngành Nghề | Sophia AI Factory'
      : 'AI Video for Every Industry | Sophia AI Factory',
    description: isVi
      ? 'Tạo video AI chuyên nghiệp cho 25+ ngành nghề. Bất động sản, thương mại điện tử, giáo dục, nhà hàng, và nhiều hơn nữa. Bắt đầu miễn phí.'
      : 'Create professional AI videos for 25+ industries. Real estate, e-commerce, education, restaurants, and more. Start free.',
    alternates: {
      languages: { en: '/en/ai-video', vi: '/vi/ai-video' },
      canonical: `/${locale}/ai-video`,
    },
  };
}

export const dynamicParams = false;

function getNicheCard(niche: string, isVi: boolean) {
  const label = NICHE_LABELS[niche as NicheSlug];
  const name = label ? (isVi ? label.vi : label.en) : niche.replace(/-/g, ' ');
  const emoji = nicheEmoji(niche);

  return { name, emoji, slug: niche };
}

/** Map niche slugs to representative emoji for visual distinction. */
function nicheEmoji(slug: string): string {
  const map: Record<string, string> = {
    'real-estate': '\u{1F3E0}',
    'e-commerce': '\u{1F6D2}',
    crypto: '\u{1F4B0}',
    health: '\u{1F3E5}',
    education: '\u{1F393}',
    restaurant: '\u{1F37D}️',
    fitness: '\u{1F4AA}',
    lawyer: '\u{2696}️',
    insurance: '\u{1F6E1}️',
    travel: '\u{2708}️',
    automotive: '\u{1F697}',
    fashion: '\u{1F454}',
    gaming: '\u{1F3AE}',
    music: '\u{1F3B5}',
    photography: '\u{1F4F8}',
    beauty: '\u{1F484}',
    sports: '\u{26BD}',
    pets: '\u{1F436}',
    'home-services': '\u{1F3E1}',
    dental: '\u{1F9B7}',
    wedding: '\u{1F48D}',
    saas: '\u{1F4BB}',
    nonprofit: '\u{1F91D}',
    construction: '\u{1F3D7}️',
    logistics: '\u{1F69A}',
  };
  return map[slug] ?? '\u{1F3AC}';
}

export default async function AiVideoHubPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  const niches = NICHE_SLUGS.map((slug) => getNicheCard(slug, isVi));

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Video className="h-4 w-4" />
            {isVi ? '25+ Ngành Nghề' : '25+ Industries'}
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
            {isVi ? 'Video AI Cho Mọi Ngành Nghề' : 'AI Video for Every Industry'}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {isVi
              ? 'Khám phá cách Sophia AI Factory tạo video chuyên nghiệp cho ngành của bạn. Không cần kỹ năng quay phim hay chỉnh sửa.'
              : 'Discover how Sophia AI Factory creates professional videos for your industry. No filming or editing skills needed.'}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
          >
            {isVi ? 'Bắt Đầu Miễn Phí' : 'Start Free'}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Niche Grid */}
      <section className="py-16 lg:py-24 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-8 max-w-6xl mx-auto">
            <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {isVi ? 'Chọn Ngành Của Bạn' : 'Choose Your Industry'}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 max-w-6xl mx-auto">
            {niches.map((niche) => (
              <Link
                key={niche.slug}
                href={`/ai-video/${niche.slug}`}
                className="group flex flex-col items-center gap-2 p-4 md:p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-center"
              >
                <span className="text-3xl md:text-4xl" role="img" aria-hidden="true">
                  {niche.emoji}
                </span>
                <span className="text-sm md:text-base font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {niche.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {isVi ? 'Sẵn Sàng Phát Triển Với Video AI?' : 'Ready to Grow With AI Video?'}
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            {isVi
              ? 'Tham gia cùng hàng nghìn doanh nghiệp đang sử dụng Sophia AI Factory để tạo video marketing tự động.'
              : 'Join thousands of businesses using Sophia AI Factory to create automated marketing videos.'}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-full text-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
          >
            {isVi ? 'Bắt Đầu Miễn Phí' : 'Start Free Today'}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
