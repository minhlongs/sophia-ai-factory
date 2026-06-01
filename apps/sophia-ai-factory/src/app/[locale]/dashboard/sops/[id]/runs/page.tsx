/**
 * /dashboard/sops/[id]/runs — dedicated run-history listing.
 *
 * Server Component: mirrors the data-fetching path in the parent
 * detail page but scopes the UI to just runs. This lets us evolve
 * the listing independently (pagination, filters) without touching
 * the tabbed detail page.
 */

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { InstallationRunsTab } from '@/components/sop/detail/installation-runs-tab';
import type { SopRunRow } from '@/tree/sop/sop-types';

interface RunsPageProps {
  params: Promise<{ id: string; locale: string }>;
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { id, locale } = await params;
  const t = await getTranslations('sop.detail_page');

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const db = getD1();
  if (!db) {
    notFound();
  }

  // Mirror the detail-page ownership check.
  const installation = (await db
    .prepare('SELECT * FROM sop_installations WHERE id = ?1')
    .bind(id)
    .all<{ id: string; user_id: string }>()
  ).results.at(0);
  if (!installation || installation.user_id !== user.id) {
    notFound();
  }

  // Same query the detail page uses (last 20 runs).
  const { results: runs } = await db
    .prepare(
      'SELECT * FROM sop_executions WHERE installation_id = ?1 ORDER BY created_at DESC LIMIT 20',
    )
    .bind(id)
    .all<SopRunRow>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t('runs.pageTitleSimple')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('runs.subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/dashboard/sops/${id}`}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          {t('runs.backToSop')}
        </Link>
      </div>

      <InstallationRunsTab runs={runs} installationId={id} />
    </div>
  );
}
