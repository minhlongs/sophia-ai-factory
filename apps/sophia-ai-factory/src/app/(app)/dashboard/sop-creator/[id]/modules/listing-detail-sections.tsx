// i18n-namespace: sop.creator
import React from 'react';
import { StatusBadge, StatCard } from './stat-components';

export interface ListingStatsGridProps {
  priceCents: number;
  installCount: number;
  rating: number;
  createdAt: number;
  locale: string;
  t: (key: string) => string;
}

export function ListingStatsGrid({
  priceCents,
  installCount,
  rating,
  createdAt,
  locale,
  t,
}: ListingStatsGridProps) {
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-8">
      <StatCard
        title={t('detail.stats.price')}
        value={formatPrice(priceCents)}
        icon="DollarSign"
        variant="primary"
      />
      <StatCard
        title={t('detail.stats.installs')}
        value={installCount.toString()}
        icon="Download"
        variant="default"
      />
      <StatCard
        title={t('detail.stats.rating')}
        value={rating.toFixed(1)}
        icon="Star"
        variant="success"
      />
      <StatCard
        title={t('detail.stats.created')}
        value={formatDate(createdAt)}
        icon="Calendar"
        variant="muted"
      />
    </div>
  );
}

export interface ListingBasicInfoCardProps {
  listing: {
    title: string;
    category: string | null;
    sop_template_id: string;
    status: string;
    description: string | null;
    tags: string | null;
  };
  statusLabels: Record<string, string>;
  t: (key: string) => string;
}

export function ListingBasicInfoCard({ listing, statusLabels, t }: ListingBasicInfoCardProps) {
  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t('detail.sections.basicInfo')}</h3>
      <dl className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('detail.fields.title')}</dt>
          <dd className="text-foreground font-medium mt-1">{listing.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('detail.fields.category')}</dt>
          <dd className="text-foreground font-medium mt-1">{listing.category || t('detail.fields.notSet')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('detail.fields.sopTemplateId')}</dt>
          <dd className="text-foreground font-medium mt-1 font-mono text-sm">{listing.sop_template_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('detail.fields.status')}</dt>
          <dd className="text-foreground font-medium mt-1">
            <StatusBadge status={listing.status} labels={statusLabels} />
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-muted-foreground">{t('detail.fields.description')}</dt>
          <dd className="text-foreground font-medium mt-1 whitespace-pre-wrap">
            {listing.description || t('detail.fields.noDescription')}
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-muted-foreground">{t('detail.fields.tags')}</dt>
          <dd className="text-foreground font-medium mt-1">
            {listing.tags
              ? JSON.parse(listing.tags).map((tag: string) => (
                  <span key={tag} className="inline-block px-2 py-1 bg-muted rounded text-sm mr-2 mb-2">
                    {tag}
                  </span>
                ))
              : t('detail.fields.noTags')}
          </dd>
        </div>
      </dl>
    </div>
  );
}
