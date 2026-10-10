import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { checkCreatorAccess } from '../ServerGate';
import { type PageProps, ListingDetail } from './modules';

export type { PageProps };
export const dynamic = 'force-dynamic';

export default async function SOPCreatorListingPage({ params }: PageProps) {
  const { locale, id } = await params;
  const access = await checkCreatorAccess();

  if (!access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator/apply`);
  }

  if (!access.userId) {
    redirect(`/${locale}/auth/login?redirect=/dashboard/sop-creator/${id}`);
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading listing...</div>}>
      <ListingDetail locale={locale} listingId={id} userId={access.userId!} />
    </Suspense>
  );
}
