/**
 * /dashboard/sop-marketplace — SOP Marketplace browse page.
 *
 * Server Component: fetches official templates + user installs.
 * Renders SopGrid (client) for filtering + install modal.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { listOfficialTemplates, listInstallationsForUser } from '@/lib/sop/sop-repo';
import { SopGrid } from '@/components/sop/sop-grid';
import { installSopAction } from './actions';
import { Store } from 'lucide-react';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'SOP Marketplace | Sophia AI' };
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export default async function MarketplacePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('sop.marketplace');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  const templates = db ? await listOfficialTemplates(db) : [];
  const installations = db ? await listInstallationsForUser(db, user.id) : [];
  const installedTemplateIds = installations.map(i => i.template_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Store className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      <SopGrid
        templates={templates}
        installedTemplateIds={installedTemplateIds}
        locale={locale}
        installAction={installSopAction}
      />
    </div>
  );
}
