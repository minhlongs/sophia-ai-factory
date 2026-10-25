import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PortalRedirectProps {
  params: Promise<{ locale: string }>;
}

export default async function AffiliatePortalPage({ params }: PortalRedirectProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/affiliate`);
}
