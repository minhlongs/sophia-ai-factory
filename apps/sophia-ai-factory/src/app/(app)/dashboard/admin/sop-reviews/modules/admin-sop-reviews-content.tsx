import React from 'react';
import { getTranslations } from 'next-intl/server';
import type { SopListing } from './types';
import { StatCard } from './stat-card';
import { PendingReviewsTable } from './pending-reviews-table';
import { PublishedListingsTable } from './published-listings-table';

export interface AdminSOPReviewsContentProps {
  locale: string;
  userId: string;
}

export async function AdminSOPReviewsContent({ locale, userId: _userId }: AdminSOPReviewsContentProps) {
  const t = await getTranslations({ locale, namespace: 'admin.sopReviews' });

  const { getD1 } = await import('@/seed/db/client');
  const d1 = await getD1();

  if (!d1) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground">Database unavailable</p>
        </div>
      </main>
    );
  }

  const pendingListings = await d1
    .prepare(
      `SELECT sl.*, cp.display_name as creator_name, cp.user_id as creator_user_id
       FROM sop_listings sl
       JOIN creator_profiles cp ON sl.creator_id = cp.id
       WHERE sl.status = 'pending_review'
       ORDER BY sl.created_at ASC`
    )
    .all<SopListing>();

  const publishedListings = await d1
    .prepare(
      `SELECT sl.*, cp.display_name as creator_name, cp.user_id as creator_user_id
       FROM sop_listings sl
       JOIN creator_profiles cp ON sl.creator_id = cp.id
       WHERE sl.status = 'published'
       ORDER BY sl.updated_at DESC
       LIMIT 20`
    )
    .all<SopListing>();

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <StatCard
            title={t('stats.pending')}
            value={pendingListings.results?.length.toString() || '0'}
            icon="Clock"
            variant="warning"
          />
          <StatCard
            title={t('stats.published')}
            value={publishedListings.results?.length.toString() || '0'}
            icon="CheckCircle"
            variant="success"
          />
          <StatCard
            title={t('stats.total')}
            value={(
              (pendingListings.results?.length || 0) + (publishedListings.results?.length || 0)
            ).toString()}
            icon="FileText"
            variant="primary"
          />
        </div>

        <PendingReviewsTable
          listings={pendingListings.results ?? []}
          locale={locale}
          t={t}
          formatDate={formatDate}
          formatPrice={formatPrice}
        />

        <PublishedListingsTable
          listings={publishedListings.results ?? []}
          locale={locale}
          t={t}
          formatDate={formatDate}
          formatPrice={formatPrice}
        />
      </div>
    </main>
  );
}
