/**
 * /dashboard/admin/licenses — License Management
 *
 * Server Component. MASTER tier only.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { LicensesClient } from '@/forest/components/dashboard/licenses-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'License Management | Admin | Sophia AI',
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminLicensesPage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">License Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage license keys — extend, reactivate, regenerate, audit.
        </p>
      </header>
      <LicensesClient />
    </div>
  );
}
