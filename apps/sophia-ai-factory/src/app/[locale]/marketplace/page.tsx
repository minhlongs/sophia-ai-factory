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
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listMarketplaceBlueprints } from '@/forest/marketplace/blueprint-service';
import { listMarketplaceTemplates } from '@/tree/marketplace/marketplace-service';
import { getCreatorBalance } from '@/tree/marketplace/royalty-engine';
import type { BlueprintSortOrder, MarketplacePlatform } from '@/seed/types/creator-marketplace';
import {
  MarketplaceHeader,
  MarketplaceFilterBar,
  MarketplaceSkeleton,
  CreatorTemplatesSection,
} from '@/land/marketplace';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    niche?: string;
    platform?: string;
    minConversionRate?: string;
    royalty?: string;
    sort?: string;
    search?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
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

  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  const pageSize = sp.pageSize ? Math.min(50, Math.max(1, parseInt(sp.pageSize, 10) || 12)) : 12;
  const minConversionRate = sp.minConversionRate ? parseFloat(sp.minConversionRate) : undefined;
  const royaltyRate = sp.royalty ? parseFloat(sp.royalty) : undefined;
  const search = sp.search || sp.q || undefined;
  const niche = sp.niche && sp.niche !== 'all' ? sp.niche : undefined;
  const platform = sp.platform && sp.platform !== 'all' ? (sp.platform as MarketplacePlatform) : undefined;
  const sort = sp.sort as BlueprintSortOrder | undefined;

  const d1 = await getD1();
  const currentUser = await getCurrentUser();

  const [blueprintsData, templatesData, royaltyBalance] = await Promise.all([
    listMarketplaceBlueprints(d1, {
      page,
      pageSize,
      niche,
      platform,
      minConversionRate,
      royaltyRate,
      search,
      sort,
      locale: locale as 'en' | 'vi',
    }),
    listMarketplaceTemplates(d1, {
      page,
      pageSize,
      niche,
      targetPlatform: platform,
      search,
      sortBy: 'trending',
    }),
    currentUser?.id ? getCreatorBalance(d1, currentUser.id) : null,
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
