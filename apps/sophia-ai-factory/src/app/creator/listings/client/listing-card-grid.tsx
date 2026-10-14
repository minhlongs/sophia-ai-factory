// i18n-namespace: marketplace.creator
'use client';

import { useTranslations } from 'next-intl';
import type { SopListingView } from '@/land/sop-marketplace';
import { STATUS_COLORS } from './types';

interface ListingCardGridProps {
  listings: SopListingView[];
  onCreateClick: () => void;
  onEditClick: (listing: SopListingView) => void;
  onPublishClick: (id: string) => void;
  onArchiveClick: (id: string) => void;
}

export function ListingCardGrid({
  listings,
  onCreateClick,
  onEditClick,
  onPublishClick,
  onArchiveClick,
}: ListingCardGridProps) {
  const t = useTranslations('marketplace.creator');

  if (listings.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">{t('noListings')}</p>
        <button
          onClick={onCreateClick}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('createListing')}
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium">{t('title')}</th>
            <th className="px-4 py-3 font-medium">{t('status')}</th>
            <th className="px-4 py-3 font-medium">{t('installCount')}</th>
            <th className="px-4 py-3 font-medium">{t('earnings')}</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {listings.map((listing) => (
            <tr key={listing.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">{listing.title}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[listing.status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {t(listing.status)}
                </span>
              </td>
              <td className="px-4 py-3">{listing.installCount}</td>
              <td className="px-4 py-3">{listing.priceDisplay}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditClick(listing)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    {t('editListing')}
                  </button>
                  {listing.status === 'draft' && (
                    <button
                      onClick={() => onPublishClick(listing.id)}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      {t('publish')}
                    </button>
                  )}
                  {listing.status === 'published' && (
                    <button
                      onClick={() => onArchiveClick(listing.id)}
                      className="rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
                    >
                      {t('archive')}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
