'use client';

/**
 * Error banner shown when onboarding step status fails to load.
 * Provides a retry button via router.refresh().
 *
 * @module app/[locale]/dashboard/onboarding/components/onboarding-error-banner
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function OnboardingErrorBanner() {
  const t = useTranslations('dashboard.onboarding.errorBanner');
  const router = useRouter();

  return (
    <div
      role="alert"
      className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 px-4 py-3 flex items-start justify-between gap-3"
    >
      <div>
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{t('title')}</p>
        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">{t('description')}</p>
      </div>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-yellow-400 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
      >
        {t('retryButton')}
      </button>
    </div>
  );
}
