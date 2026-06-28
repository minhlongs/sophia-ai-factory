/**
 * /dashboard/sops — User's installed SOP list.
 *
 * Server Component: fetches installations with template data.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listInstallationsForUser, getTemplatesByIds } from '@/tree/sop/sop-repo';
import { InstallationListTable } from '@/forest/components/sop/installation-list-table';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { BookOpen, Store, PartyPopper } from 'lucide-react';
import type { SopInstallationRow, SopTemplateRow } from '@/tree/sop/sop-types';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { getD1 } from '@/seed/db/get-d1';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';


interface InstallWithTemplate extends SopInstallationRow {
  template: SopTemplateRow | null;
}

export default async function SopsListPage({ params }: Props) {
  const { locale } = await params;
  const [t, tEmpty] = await Promise.all([
    getTranslations('sop.list'),
    getTranslations('dashboard.emptyState.sops'),
  ]);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  const installations = db ? await listInstallationsForUser(db, user.id) : [];

  // Batch-fetch templates (single query instead of N+1)
  const uniqueIds = [...new Set(installations.map(i => i.template_id))];
  const templates = db ? await getTemplatesByIds(db, uniqueIds) : [];
  const tplMap = new Map(templates.map(t => [t.id, t]));
  const withTemplates: InstallWithTemplate[] = installations.map(inst => ({
    ...inst,
    template: tplMap.get(inst.template_id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-primary-400" aria-hidden="true" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <RouteHelpTooltip locale={locale} routeKey="sops" />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      {withTemplates.length === 0 ? (
        <EmptyState
          icon={Store}
          title={tEmpty('title')}
          description={tEmpty('description')}
          cta={{ label: tEmpty('cta'), href: '/dashboard/sop-marketplace' }}
        />
      ) : (
        <>
          {withTemplates.length === 1 && <FirstSopCallout locale={locale} />}
          <InstallationListTable installations={withTemplates} locale={locale} />
        </>
      )}
    </div>
  );
}

async function FirstSopCallout({ locale }: { locale: string }) {
  const t = await getTranslations('sop.list');
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-start gap-3">
      <PartyPopper className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <h2 className="text-sm font-semibold text-emerald-100">
          {t('firstInstallTitle')}
        </h2>
        <p className="text-xs text-muted-foreground-300 leading-relaxed">
          {t('firstInstallDesc')}
        </p>
      </div>
    </div>
  );
}
