import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  type PageProps,
  type SopListing,
  checkAdminAccess,
  AdminSOPReviewsContent,
} from './modules';

export type { SopListing, PageProps };
export const dynamic = 'force-dynamic';

export default async function AdminSOPReviewsPage({ params }: PageProps) {
  const { locale } = await params;
  const access = await checkAdminAccess();

  if (!access.isAdmin) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading admin reviews...</div>}>
      <AdminSOPReviewsContent locale={locale} userId={access.userId!} />
    </Suspense>
  );
}
