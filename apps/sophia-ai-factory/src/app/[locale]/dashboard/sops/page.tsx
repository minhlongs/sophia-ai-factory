/**
 * /dashboard/sops — User's installed SOP list.
 *
 * Server Component: fetches installations with template data.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listInstallationsForUser, getTemplateById } from '@/lib/sop/sop-repo';
import { InstallationListTable } from '@/forest/components/sop/installation-list-table';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { BookOpen, Store, PartyPopper } from 'lucide-react';
import type { SopInstallationRow, SopTemplateRow } from '@/lib/sop/sop-types';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';

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
  const [t, tEmpty] = await Promise.all([
    getTranslations('sop.list'),
    getTranslations('dashboard.emptyState.sops'),
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
        <BookOpen className="w-5 h-5 text-violet-400" aria-hidden="true" />
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

function FirstSopCallout({ locale }: { locale: string }) {
  const isVi = locale.startsWith('vi');
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-start gap-3">
      <PartyPopper className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <h2 className="text-sm font-semibold text-emerald-100">
          {isVi ? 'SOP đầu tiên đã cài đặt!' : 'First SOP installed!'}
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          {isVi
            ? 'Bấm vào dòng SOP bên dưới → tab "Run" → nhập tham số → bấm Run. Video sẽ xuất hiện ở /dashboard/videos sau 2-5 phút.'
            : 'Click the SOP row below → "Run" tab → enter parameters → click Run. Your video appears in /dashboard/videos in 2-5 minutes.'}
        </p>
      </div>
    </div>
  );
}
