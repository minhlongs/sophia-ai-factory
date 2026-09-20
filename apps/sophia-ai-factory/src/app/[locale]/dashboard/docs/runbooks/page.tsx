export const dynamic = 'force-dynamic';

/**
 * Customer Operational Runbooks Index Route
 * Layer: app router (Next.js App Router; can import from all layers)
 *
 * Route: /dashboard/docs/runbooks & /vi/dashboard/docs/runbooks
 * Renders the full 10-SOP customer documentation catalog with default to SOP 01 Quickstart.
 *
 * @module app/[locale]/dashboard/docs/runbooks/page
 */

import { notFound } from 'next/navigation';
import {
  listRunbooks,
  getRunbookBySlug,
  RUNBOOK_CATALOG,
} from '@/tree/handover/runbook-catalog-service';
import { RunbookReaderClient } from '@/forest/components/runbooks/runbook-reader-client';

export default async function RunbooksOverviewPageRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = locale === 'vi' ? 'vi' : 'en';

  const catalog = listRunbooks(activeLocale);
  const defaultRunbook = getRunbookBySlug('quickstart', activeLocale) || RUNBOOK_CATALOG[0];

  if (!defaultRunbook) {
    notFound();
  }

  return (
    <RunbookReaderClient
      runbooks={catalog}
      activeRunbook={defaultRunbook}
      locale={locale}
    />
  );
}
