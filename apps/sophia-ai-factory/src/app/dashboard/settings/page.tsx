import { Suspense } from 'react';
import { Metadata } from 'next';
import { getUserProfile } from '@/app/actions/settings';
import { SettingsForm } from '@/components/settings/settings-form';

export const metadata: Metadata = {
  title: 'Settings - Sophia AI Factory',
  description: 'Manage your profile, preferences, and API keys.',
};

export default async function SettingsPage() {
  const profile = await getUserProfile();

  // If getUserProfile throws (Unauthorized), Next.js error boundary will handle it
  // or middleware should have redirected already.

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsForm defaultValues={profile} />
      </Suspense>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 w-full animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
