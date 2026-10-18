/**
 * Creator Video Blueprint Marketplace Discovery Page
 *
 * Layer: app (Next.js 15 Server Component orchestrating forest services and land UI)
 *
 * @module app/[locale]/marketplace/page
 */

import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  MarketplaceHeader,
  MarketplaceFilterBar,
  MarketplaceSkeleton,
  CreatorTemplatesSection,
} from '@/land/marketplace';
import { StitchWave2RouteBanner } from '@/components/stitch/screens/control-deck/stitch-wave2-route-banner';
import {
  parseMarketplaceSearchParams,
  loadMarketplacePageData,
  type MarketplaceSearchParamsInput,
} from './marketplace-page-helpers';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<MarketplaceSearchParamsInput>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blueprintMarketplace' });

  return {
    title: `${t('title')} | Sophia AI Factory`,
    description: t('subtitle'),
    openGraph: {
      title: `${t('title')} | Sophia AI Factory`,
      description: t('subtitle'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('title')} | Sophia AI Factory`,
      description: t('subtitle'),
    },
  };
}

export default async function MarketplacePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const filters = parseMarketplaceSearchParams(sp);
  const { page, pageSize, niche, platform, minConversionRate, royaltyRate, search, sort } = filters;

  const { blueprintsData, templatesData, royaltyBalance, currentUser } =
    await loadMarketplacePageData(locale, filters);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F8FAFC]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <StitchWave2RouteBanner routeKey="marketplace" defaultShowCanvas={true} />
        {/* Hero Headline */}
        <MarketplaceHeader />

        {/* Faceted Filter Bar */}
        <MarketplaceFilterBar
          initialFilters={{
            niche,
            platform,
            minConversionRate,
            royaltyRate,
            search,
            sort,
            page,
            pageSize,
            locale: locale as 'en' | 'vi',
          }}
        />

        {/* Catalog Section with Loading Suspense */}
        <Suspense fallback={<MarketplaceSkeleton />}>
          <CreatorTemplatesSection
            blueprints={blueprintsData.items}
            totalBlueprints={blueprintsData.total}
            templates={templatesData.items}
            totalTemplates={templatesData.total}
            page={page}
            pageSize={pageSize}
            totalPages={Math.max(blueprintsData.totalPages, templatesData.totalPages)}
            currentUserId={currentUser?.id}
            royaltyBalance={royaltyBalance}
          />
        </Suspense>
      </div>
    </div>
  );
}
