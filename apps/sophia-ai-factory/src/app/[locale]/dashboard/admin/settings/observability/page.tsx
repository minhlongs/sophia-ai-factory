// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/settings/observability — Observability settings page (admin only).
 *
 * Re-exports HoneycombSettings for Honeycomb OTel configuration.
 * This is the canonical location; the byok-rotation page also renders
 * the component for convenience but this route is the primary admin UI.
 *
 * @module app/[locale]/dashboard/admin/settings/observability/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import HoneycombSettings from '../../byok-rotation/components/honeycomb-settings';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ObservabilitySettingsPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const isVi = locale.startsWith('vi');
  await requireMasterTier();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {isVi ? 'Cau Hinh Quan Sat' : 'Observability Settings'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isVi
              ? 'Cau hinh Honeycomb OTel de theo doi hieu nang he thong.'
              : 'Configure Honeycomb OTel for system performance tracing.'}
          </p>
        </div>
      </header>

      <HoneycombSettings locale={locale} />
    </div>
  );
}
