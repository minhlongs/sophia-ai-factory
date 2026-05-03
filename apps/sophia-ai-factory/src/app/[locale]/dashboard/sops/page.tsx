/**
 * /dashboard/sops — User's installed SOP list.
 *
 * Server Component: fetches installations with template data.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { listInstallationsForUser, getTemplateById } from '@/lib/sop/sop-repo';
import { InstallationListTable } from '@/components/sop/installation-list-table';
import { BookOpen, Store } from 'lucide-react';
import type { SopInstallationRow, SopTemplateRow } from '@/lib/sop/sop-types';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

interface InstallWithTemplate extends SopInstallationRow {
  template: SopTemplateRow | null;
}

export default async function SopsListPage({ params }: Props) {
  const { locale } = await params;
  const [t, tDash] = await Promise.all([
    getTranslations('sop.list'),
    getTranslations('dashboard.sops'),
  ]);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  const installations = db ? await listInstallationsForUser(db, user.id) : [];

  // Enrich with template data
  const withTemplates: InstallWithTemplate[] = await Promise.all(
    installations.map(async (inst) => {
      const template = db ? await getTemplateById(db, inst.template_id) : null;
      return { ...inst, template };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      {withTemplates.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-10 flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Store className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tDash('empty_title')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{tDash('empty_desc')}</p>
          </div>
          <Link
            href="/dashboard/sop-marketplace"
            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-150"
          >
            <Store className="w-4 h-4" />
            {tDash('empty_cta')}
          </Link>
        </div>
      ) : (
        <InstallationListTable installations={withTemplates} locale={locale} />
      )}
    </div>
  );
}
