// i18n-namespace: marketplace.creator
'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { publishListing, archiveListing } from '@/land/sop-marketplace';
import { ListingForm, type ListingFormInitialData } from '@/components/creator/ListingForm';
import type { ActiveView, ListingsClientProps } from './types';
import { ListingFilters } from './listing-filters';
import { ListingCardGrid } from './listing-card-grid';

export function ListingsView({ initialListings }: ListingsClientProps) {
  const t = useTranslations('marketplace.creator');
  const [listings, setListings] = useState(initialListings);
  const [view, setView] = useState<ActiveView>({ type: 'table' });
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshListings = useCallback(async () => {
    setView({ type: 'table' });
  }, []);

  const handlePublish = useCallback(
    async (id: string) => {
      if (!window.confirm(t('confirmPublish'))) return;
      setActionError(null);
      const result = await publishListing(id);
      if (result.ok) {
        setListings((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: 'published' as const } : l)),
        );
      } else {
        setActionError(result.error.message);
      }
    },
    [t],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (!window.confirm(t('confirmArchive'))) return;
      setActionError(null);
      const result = await archiveListing(id);
      if (result.ok) {
        setListings((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: 'archived' as const } : l)),
        );
      } else {
        setActionError(result.error.message);
      }
    },
    [t],
  );

  if (view.type === 'create') {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold">{t('createListing')}</h2>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <ListingForm
            mode="create"
            onSuccess={refreshListings}
            onCancel={() => setView({ type: 'table' })}
          />
        </div>
      </div>
    );
  }

  if (view.type === 'edit') {
    const listing = view.listing;
    const initialData: ListingFormInitialData = {
      id: listing.id,
      title: listing.title,
      description: listing.description ?? undefined,
      priceCents: listing.priceCents,
      category: listing.category ?? undefined,
      sopTemplateId: listing.sopTemplateId,
      thumbnailUrl: listing.thumbnailUrl ?? undefined,
    };

    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold">{t('editListing')}</h2>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <ListingForm
            mode="edit"
            initialData={initialData}
            onSuccess={refreshListings}
            onCancel={() => setView({ type: 'table' })}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ListingFilters
        actionError={actionError}
        onCreateClick={() => setView({ type: 'create' })}
      />
      <ListingCardGrid
        listings={listings}
        onCreateClick={() => setView({ type: 'create' })}
        onEditClick={(listing) => setView({ type: 'edit', listing })}
        onPublishClick={handlePublish}
        onArchiveClick={handleArchive}
      />
    </div>
  );
}
