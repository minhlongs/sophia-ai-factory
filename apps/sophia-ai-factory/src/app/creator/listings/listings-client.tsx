/**
 * ListingsClient — interactive client component for managing SOP marketplace listings.
 *
 * Handles table display, create/edit forms, publish, and archive actions.
 * Receives pre-fetched listing data from the server page.
 *
 * @module app/creator/listings/listings-client
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { SopListingView } from '@/land/sop-marketplace';
import { publishListing, archiveListing } from '@/land/sop-marketplace';
import { ListingForm, type ListingFormInitialData } from '@/components/creator/ListingForm';

interface ListingsClientProps {
  initialListings: SopListingView[];
}

type ActiveView =
  | { type: 'table' }
  | { type: 'create' }
  | { type: 'edit'; listing: SopListingView };

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export default function ListingsClient({ initialListings }: ListingsClientProps) {
  const t = useTranslations('marketplace.creator');
  const [listings, setListings] = useState(initialListings);
  const [view, setView] = useState<ActiveView>({ type: 'table' });
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshListings = useCallback(async () => {
    setView({ type: 'table' });
    // The server component re-fetches on page reload; client state is optimistic.
    // On success of create/edit, the parent page will reload via router.refresh().
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

  const handleEditSuccess = useCallback(() => {
    refreshListings();
  }, [refreshListings]);

  const handleCreateSuccess = useCallback(() => {
    refreshListings();
  }, [refreshListings]);

  // ── Create Form View ──────────────────────────────────────────────────
  if (view.type === 'create') {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold">{t('createListing')}</h2>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <ListingForm
            mode="create"
            onSuccess={handleCreateSuccess}
            onCancel={() => setView({ type: 'table' })}
          />
        </div>
      </div>
    );
  }

  // ── Edit Form View ────────────────────────────────────────────────────
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
            onSuccess={handleEditSuccess}
            onCancel={() => setView({ type: 'table' })}
          />
        </div>
      </div>
    );
  }

  // ── Table View ────────────────────────────────────────────────────────
  return (
    <div>
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {actionError}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => setView({ type: 'create' })}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('createListing')}
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">{t('noListings')}</p>
          <button
            onClick={() => setView({ type: 'create' })}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('createListing')}
          </button>
        </div>
      ) : (
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
                        onClick={() =>
                          setView({ type: 'edit', listing })
                        }
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        {t('editListing')}
                      </button>
                      {listing.status === 'draft' && (
                        <button
                          onClick={() => handlePublish(listing.id)}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          {t('publish')}
                        </button>
                      )}
                      {listing.status === 'published' && (
                        <button
                          onClick={() => handleArchive(listing.id)}
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
      )}
    </div>
  );
}
