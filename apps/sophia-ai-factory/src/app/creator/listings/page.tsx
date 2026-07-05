/**
 * /creator/listings — Creator listing management page.
 *
 * Server component that auth-gates, fetches the user's listings,
 * and renders the interactive ListingsClient.
 *
 * @module app/creator/listings/page
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listMyListings } from '@/land/sop-marketplace';
import ListingsClient from './listings-client';

export default async function CreatorListingsPage() {
  const t = await getTranslations('marketplace.creator');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const listingsResult = await listMyListings();
  if (!listingsResult.ok) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {listingsResult.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('listings')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ListingsClient initialListings={listingsResult.value} />
    </div>
  );
}
