/**
 * /dashboard/sops — User's installed SOP list.
 *
 * Server Component: fetches installations with template data.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { listInstallationsForUser, getTemplateById } from '@/lib/sop/sop-repo';
import { InstallationListTable } from '@/components/sop/installation-list-table';
import { BookOpen } from 'lucide-react';
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
  const t = await getTranslations('sop.list');

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
        <BookOpen className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      <InstallationListTable installations={withTemplates} locale={locale} />
    </div>
  );
}
