import React from 'react';
import { getTranslations } from 'next-intl/server';
import { ExternalLink } from 'lucide-react';
import type { ListingDetailProps } from './types';
import { StatusBadge } from './stat-components';
import { ListingActionsClient } from './listing-actions-client';
import { ListingBasicInfoCard, ListingStatsGrid } from './listing-detail-sections';
import { loadCreatorListingOrThrow } from './listing-detail-loader';
import { CREATOR_MARKETPLACE_V2_ENABLED } from '@/land/sop-marketplace/availability';
import { MarketplaceUnavailableNotice } from '@/components/sop-marketplace/marketplace-unavailable-notice';

export async function ListingDetail({ locale, listingId, userId }: ListingDetailProps) {
  if (!CREATOR_MARKETPLACE_V2_ENABLED) {
    return <main className="min-h-screen bg-background p-8"><MarketplaceUnavailableNotice /></main>;
  }

  const [t, tStatus, loadResult] = await Promise.all([
    getTranslations({ locale, namespace: 'sop.creator' }),
    getTranslations({ locale, namespace: 'sop.status' }),
    loadCreatorListingOrThrow(listingId, userId),
  ]);

  if (!loadResult.d1Available) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-muted-foreground">Database unavailable</p>
        </div>
      </main>
    );
  }

  const { listing } = loadResult;
  const statusLabels: Record<string, string> = {
    draft: tStatus('draft'),
    published: tStatus('published'),
    archived: tStatus('archived'),
    pending_review: tStatus('pending_review'),
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <a
              href={`/${locale}/dashboard/sop-creator`}
              className="text-primary hover:underline text-sm mb-2 inline-block"
            >
              ← {t('dashboard.actions.myListings')}
            </a>
            <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>
            <p className="text-muted-foreground mt-1">{t('detail.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={listing.status} labels={statusLabels} />
          </div>
        </div>

        <ListingStatsGrid
          priceCents={listing.price_cents}
          installCount={listing.install_count}
          rating={listing.rating}
          createdAt={listing.created_at}
          locale={locale}
          t={t}
        />

        <div className="space-y-6">
          <ListingBasicInfoCard listing={listing} statusLabels={statusLabels} t={t} />

          {(listing.thumbnail_url || listing.demo_video_url) && (
            <div className="bg-card border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('detail.sections.media')}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {listing.thumbnail_url && (
                  <div>
                    <dt className="text-muted-foreground text-sm mb-2">{t('detail.fields.thumbnail')}</dt>
                    {/* eslint-disable-next-line @next/next/no-img-element -- dynamic external URL, no remotePatterns configured */}
                    <img
                      src={listing.thumbnail_url}
                      alt="Thumbnail"
                      className="rounded-lg border max-h-48 w-full object-cover"
                    />
                  </div>
                )}
                {listing.demo_video_url && (
                  <div>
                    <dt className="text-muted-foreground text-sm mb-2">{t('detail.fields.demoVideo')}</dt>
                    <a
                      href={listing.demo_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('detail.fields.viewVideo')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('detail.actions.title')}</h3>
            <ListingActionsClient
              listingId={listingId}
              locale={locale}
              status={listing.status}
              labels={{
                edit: t('detail.actions.edit'),
                submitForReview: t('detail.actions.submitForReview'),
                underReview: t('detail.actions.underReview'),
                archive: t('detail.actions.archive'),
                archived: t('detail.actions.archived'),
                viewInMarketplace: t('detail.actions.viewInMarketplace'),
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
