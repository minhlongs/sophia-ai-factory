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

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/navigation';
import { getBySlug, getAllSlugs } from '@/seed/db/repositories/landing-pages-repo';
import { generateLandingPageContent } from '@/tree/landing/llm-fallback-generator';
import { NICHE_SLUGS, NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { Zap, ArrowRight, Play, CheckCircle, Film, BarChart3, Globe } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────────

interface PageParams {
  locale: string;
  niche: string;
}

interface PageContent {
  heroTitle: string;
  heroSub: string;
  features: Array<{ icon: string; title: string; desc: string }>;
  faq: Array<{ question: string; answer: string }>;
  nicheLabel: string;
}

// ── generateStaticParams ─────────────────────────────────────────────────────────

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
    // Fallback: at minimum, build NICHE_SLUGS pages
    return NICHE_SLUGS.flatMap((slug) => [
      { locale: 'en', niche: slug },
      { locale: 'vi', niche: slug },
    ]);
  }
}

export const dynamicParams = true;

// ── generateMetadata ─────────────────────────────────────────────────────────────

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

  // Fallback metadata for non-D1 niches
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

// ── Page Component ───────────────────────────────────────────────────────────────

export default async function NicheLandingPage({
  params,
}: {
  params: Promise<{ locale: string; niche: string }>;
}) {
  const { locale, niche } = await params;
  const isVi = locale === 'vi';

  // Resolve content: D1 → LLM fallback → 404
  let content: PageContent;

  try {
    const d1Page = await getBySlug(niche);

    if (d1Page) {
      content = {
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
    } else {
      // Try LLM fallback with admin BYOK key
      const apiKey = await resolveUserApiKey(
        null, // No user context at request time
        'openrouter',
        process.env.OPENROUTER_API_KEY,
      );

      const generated = await generateLandingPageContent(niche, apiKey ?? undefined);
      const label = NICHE_LABELS[niche as NicheSlug];
      const nicheLabel = label
        ? `${label.en} / ${label.vi}`
        : niche.replace(/-/g, ' ');

      content = {
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
  } catch (err) {
    logger.error('[LandingSSG] Failed to load content', {
      niche,
      locale,
      error: getErrorMessage(err),
    });
    notFound();
  }

  // Icon resolver — maps icon string to Lucide component via category groups
  const iconElements: Record<string, React.ReactNode> = {
    zap: <Zap className="h-8 w-8" />,
    film: <Film className="h-8 w-8" />,
    chart: <BarChart3 className="h-8 w-8" />,
    globe: <Globe className="h-8 w-8" />,
    play: <Play className="h-8 w-8" />,
    arrow: <ArrowRight className="h-8 w-8" />,
    check: <CheckCircle className="h-8 w-8" />,
  };

  // Map individual icon names → category
  const iconCategory: Record<string, string> = {
    home: 'film', 'shopping-cart': 'play', smartphone: 'play', repeat: 'arrow',
    'trending-up': 'chart', users: 'chart', 'bar-chart': 'chart', compare: 'chart',
    coins: 'zap', rocket: 'zap', dumbbell: 'zap', utensils: 'zap', 'chef-hat': 'zap',
    sparkles: 'zap', swords: 'zap',
    'message-circle': 'check', shield: 'check', heart: 'check', apple: 'check',
    brain: 'check', award: 'check', star: 'check', target: 'check', calendar: 'check',
    scale: 'check', briefcase: 'check', umbrella: 'check', 'shield-check': 'check',
    smile: 'check', wrench: 'check', 'thumbs-up': 'check', shirt: 'check', trophy: 'check',
    bookmark: 'check',
    'map-pin': 'globe', languages: 'globe', map: 'globe', compass: 'globe', globe: 'globe',
    'book-open': 'play', presentation: 'play', 'play-circle': 'play', 'file-text': 'play',
    camera: 'play', 'shopping-bag': 'play', gamepad: 'play', twitch: 'play',
    music: 'play', mic: 'play', disc: 'play', headphones: 'play', edit: 'play', video: 'play',
    truck: 'arrow', 'phone-call': 'arrow', car: 'arrow',
  };

  const resolveIcon = (iconName: string): React.ReactNode =>
    iconElements[iconCategory[iconName] ?? 'zap'];

  return (
    <main className="min-h-screen">
      {/* JSON-LD Structured Data */}
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

      {/* Section: Hero */}
      <HeroSection
        title={content.heroTitle}
        subtitle={content.heroSub}
        ctaText={isVi ? 'Bắt Đầu Miễn Phí' : 'Start Free'}
        signupUrl="/signup"
      />

      {/* Section: Features */}
      <FeaturesSection
        features={content.features}
        title={isVi ? 'Tính Năng Chính' : 'Key Features'}
        resolveIcon={resolveIcon}
      />

      {/* Section: How It Works */}
      <HowItWorksSection isVi={isVi} />

      {/* Section: Pricing */}
      <PricingTeaserSection isVi={isVi} />

      {/* Section: FAQ */}
      {content.faq.length > 0 && (
        <FaqSection
          faq={content.faq}
          title={isVi ? 'Câu Hỏi Thường Gặp' : 'Frequently Asked Questions'}
        />
      )}

      {/* Section: CTA */}
      <CtaSection
        nicheLabel={content.nicheLabel}
        isVi={isVi}
        signupUrl="/signup"
      />
    </main>
  );
}

// ── Section Components ───────────────────────────────────────────────────────────

function HeroSection({
  title,
  subtitle,
  ctaText,
  signupUrl,
}: {
  title: string;
  subtitle: string;
  ctaText: string;
  signupUrl: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 py-20 lg:py-28">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          {subtitle}
        </p>
        <Link
          href={signupUrl}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
        >
          {ctaText}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function FeaturesSection({
  features,
  title,
  resolveIcon,
}: {
  features: Array<{ icon: string; title: string; desc: string }>;
  title: string;
  resolveIcon: (name: string) => React.ReactNode;
}) {
  return (
    <section className="py-20 bg-white dark:bg-gray-950">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {title}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="text-blue-600 dark:text-blue-400 mb-4">
                {resolveIcon(feature.icon)}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection({ isVi }: { isVi: boolean }) {
  const steps = isVi
    ? [
        { step: '1', title: 'Mô Tả Nhu Cầu', desc: 'Nhập chủ đề hoặc ý tưởng video của bạn. AI sẽ tạo kịch bản tự động.' },
        { step: '2', title: 'AI Tạo Video', desc: 'Sophia AI xử lý tường thuật, hình ảnh và chỉnh sửa — tất cả tự động.' },
        { step: '3', title: 'Đăng & Phát Triển', desc: 'Tải video lên mạng xã hội và thu hút khách hàng 24/7.' },
      ]
    : [
        { step: '1', title: 'Describe Your Needs', desc: 'Enter your topic or video idea. AI generates the script automatically.' },
        { step: '2', title: 'AI Creates the Video', desc: 'Sophia AI handles narration, visuals, and editing — all automated.' },
        { step: '3', title: 'Publish & Grow', desc: 'Upload to social media and attract customers 24/7.' },
      ];

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {isVi ? 'Cách Hoạt Động' : 'How It Works'}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{s.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTeaserSection({ isVi }: { isVi: boolean }) {
  const tiers = isVi
    ? [
        { name: 'Basic', price: 'Miễn Phí', features: ['5 video/tháng', 'Giọng đọc AI cơ bản', 'Hỗ trợ email'] },
        { name: 'Premium', price: '$29/tháng', features: ['50 video/tháng', 'Giọng đọc AI cao cấp', 'Hỗ trợ ưu tiên', 'Phân tích nâng cao'] },
        { name: 'Enterprise', price: '$99/tháng', features: ['Video không giới hạn', 'Tùy chỉnh đầy đủ', 'Hỗ trợ riêng', 'API truy cập'] },
      ]
    : [
        { name: 'Basic', price: 'Free', features: ['5 videos/month', 'Basic AI voiceover', 'Email support'] },
        { name: 'Premium', price: '$29/mo', features: ['50 videos/month', 'Premium AI voices', 'Priority support', 'Advanced analytics'] },
        { name: 'Enterprise', price: '$99/mo', features: ['Unlimited videos', 'Full customization', 'Dedicated support', 'API access'] },
      ];

  return (
    <section className="py-20 bg-white dark:bg-gray-950">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          {isVi ? 'Bảng Giá Đơn Giản' : 'Simple Pricing'}
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          {isVi ? 'Bắt đầu miễn phí, nâng cấp khi bạn phát triển.' : 'Start free, upgrade as you grow.'}
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="p-8 rounded-xl border border-gray-200 dark:border-gray-800 text-center hover:shadow-lg transition-shadow"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{tier.name}</h3>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">{tier.price}</p>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold transition-colors"
              >
                {isVi ? 'Bắt Đầu' : 'Get Started'}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({
  faq,
  title,
}: {
  faq: Array<{ question: string; answer: string }>;
  title: string;
}) {
  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {title}
        </h2>
        <div className="space-y-4">
          {faq.map((item, i) => (
            <details
              key={i}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <summary className="flex justify-between items-center cursor-pointer font-semibold text-gray-900 dark:text-white">
                {item.question}
                <span className="text-blue-600 dark:text-blue-400 text-xl ml-4 group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({
  nicheLabel,
  isVi,
  signupUrl,
}: {
  nicheLabel: string;
  isVi: boolean;
  signupUrl: string;
}) {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {isVi
            ? `Sẵn Sàng Tạo Video ${nicheLabel} Bằng AI?`
            : `Ready to Create AI ${nicheLabel} Videos?`}
        </h2>
        <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
          {isVi
            ? 'Tham gia cùng hàng nghìn doanh nghiệp đang sử dụng Sophia AI Factory để phát triển với video.'
            : 'Join thousands of businesses using Sophia AI Factory to grow with video.'}
        </p>
        <Link
          href={signupUrl}
          className="inline-flex items-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-full text-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
        >
          {isVi ? 'Bắt Đầu Miễn Phí' : 'Start Free Today'}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}
