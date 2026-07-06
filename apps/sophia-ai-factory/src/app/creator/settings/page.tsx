/**
 * /creator/settings — Creator settings page.
 *
 * Server component that auth-gates, fetches the current creator profile,
 * and renders the settings form pre-filled with existing data.
 *
 * @module app/creator/settings/page
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getCreatorProfile } from '@/land/sop-marketplace';
import CreatorSettingsForm from './settings-form';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketplace.creator');
  const title = t('settings');
  const description = t('subtitle');
  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/creator/settings` },
    openGraph: { title, description, url: `${APP_URL}/creator/settings`, siteName: 'Sophia AI Factory', type: 'website' },
    twitter: { title, description, card: 'summary_large_image' },
  };
}

export default async function CreatorSettingsPage() {
  const t = await getTranslations('marketplace.creator');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const profileResult = await getCreatorProfile();

  // Not registered — redirect to creator dashboard to register first
  if (!profileResult.ok && profileResult.error.code === 'PROFILE_NOT_FOUND') {
    redirect('/creator');
  }

  // Unexpected error
  if (!profileResult.ok) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {profileResult.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/creator"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {t('title')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{t('settings')}</h1>
        <p className="mt-2 text-muted-foreground">{t('editProfile')}</p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <CreatorSettingsForm profile={profileResult.value} />
      </div>
    </div>
  );
}
