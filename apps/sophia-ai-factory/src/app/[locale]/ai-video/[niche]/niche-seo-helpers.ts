/**
 * Static params and SEO metadata builders for /[locale]/ai-video/[niche] landing page.
 * @module app/[locale]/ai-video/[niche]/niche-seo-helpers
 */

import type { Metadata } from 'next';
import { getBySlug, getAllSlugs } from '@/seed/db/repositories/landing-pages-repo';
import { NICHE_SLUGS, NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { PageParams } from '@/components/landing/niche-page/types';

export async function buildNicheStaticParams(): Promise<PageParams[]> {
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

export async function buildNicheMetadata(
  locale: string,
  niche: string,
): Promise<Metadata> {
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
    ? locale === 'vi'
      ? label.vi
      : label.en
    : niche.replace(/-/g, ' ');

  return {
    title:
      locale === 'vi'
        ? `Video AI Cho ${nicheName} | Sophia AI Factory`
        : `AI Video for ${nicheName} | Sophia AI Factory`,
    description:
      locale === 'vi'
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
