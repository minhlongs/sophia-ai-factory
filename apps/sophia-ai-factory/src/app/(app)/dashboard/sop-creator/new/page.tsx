import { redirect } from 'next/navigation';
import { checkCreatorAccess } from '../ServerGate';
import { Suspense } from 'react';
import { MarketplaceUnavailableNotice } from '@/components/sop-marketplace/marketplace-unavailable-notice';
import { NewListingForm } from './new-listing-form';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function NewListingPage({ params }: PageProps) {
  const { locale } = await params;
  const access = await checkCreatorAccess();

  if (!access.userId) {
    redirect(`/${locale}/auth/login?redirect=/dashboard/sop-creator/new`);
  }
  if (!access.marketplaceAvailable) {
    return (
      <main className="min-h-screen bg-background p-8">
        <MarketplaceUnavailableNotice />
      </main>
    );
  }
  if (!access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator/apply`);
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
          <NewListingForm locale={locale} userId={access.userId!} />
        </Suspense>
      </div>
    </main>
  );
}
