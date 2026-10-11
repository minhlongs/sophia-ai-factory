// i18n-namespace: marketplace.creator
import Link from 'next/link';
import { CreatorOnboardingForm } from '@/components/creator/CreatorOnboardingForm';
import type { ProfileCardProps, OnboardingViewProps } from './types';

export function ProfileCard({ profile, t }: ProfileCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="mb-4 text-lg font-semibold">
          {profile.displayName}
        </h2>
        <Link
          href="/creator/settings"
          className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 min-h-9"
        >
          {t('editProfile')}
        </Link>
      </div>
      <div className="space-y-3 text-sm">
        {profile.bio && (
          <div>
            <span className="font-medium text-muted-foreground">
              {t('bio')}:
            </span>{' '}
            {profile.bio}
          </div>
        )}
        <div>
          <span className="font-medium text-muted-foreground">
            {t('payoutMethod')}:
          </span>{' '}
          {profile.payoutMethod ?? '—'}
        </div>
        <div>
          <span className="font-medium text-muted-foreground">
            {t('payoutAddress')}:
          </span>{' '}
          {profile.payoutAddress ?? '—'}
        </div>
      </div>
    </div>
  );
}

export function OnboardingView({ t }: OnboardingViewProps) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('registerTitle')}</h1>
        <p className="mt-1 text-muted-foreground">{t('registerSubtitle')}</p>
      </div>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <CreatorOnboardingForm />
      </div>
    </div>
  );
}
