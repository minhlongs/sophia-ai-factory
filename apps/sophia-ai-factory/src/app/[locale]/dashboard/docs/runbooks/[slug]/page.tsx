export const dynamic = 'force-dynamic';

/**
 * Customer Operational Runbook Detail Route
 * Layer: app router (Next.js App Router; can import from all layers)
 *
 * Route: /dashboard/docs/runbooks/[slug] & /vi/dashboard/docs/runbooks/[slug]
 * Renders an individual operational SOP deep-linked with full bilingual support.
 *
 * @module app/[locale]/dashboard/docs/runbooks/[slug]/page
 */

import { notFound } from 'next/navigation';
import {
  listRunbooks,
  getRunbookBySlug,
} from '@/tree/handover/runbook-catalog-service';
import { RunbookReaderClient } from '@/forest/components/runbooks/runbook-reader-client';

export default async function RunbookDetailPageRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = locale === 'vi' ? 'vi' : 'en';

  const runbook = getRunbookBySlug(slug, activeLocale);
  if (!runbook) {
    notFound();
  }

  const catalog = listRunbooks(activeLocale);

  return (
    <RunbookReaderClient
      runbooks={catalog}
      activeRunbook={runbook}
      locale={locale}
    />
  );
}
