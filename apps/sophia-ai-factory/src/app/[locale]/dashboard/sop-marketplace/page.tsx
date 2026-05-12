/**
 * /dashboard/sop-marketplace — SOP Marketplace browse page.
 *
 * Server Component: fetches official templates + user installs.
 * Renders SopGrid (client) for filtering + install modal.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listOfficialTemplates, listInstallationsForUser } from '@/lib/sop/sop-repo';
import { SopGrid } from '@/forest/components/sop/sop-grid';
import { installSopAction } from './actions';
import { Store, Sparkles } from 'lucide-react';

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

  const isVi = locale.startsWith('vi');
  const isFirstTime = installations.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Store className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      {isFirstTime && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-violet-100">
              {isVi ? 'Lần đầu cài SOP?' : 'First time installing a SOP?'}
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isVi
                ? '3 bước: (1) chọn template phù hợp dưới đây, (2) bấm Install, (3) vào /dashboard/sops bấm Run để tạo video đầu tiên. Mất ~5 phút.'
                : '3 steps: (1) pick a template below, (2) click Install, (3) go to /dashboard/sops and click Run to generate your first video. ~5 minutes total.'}
            </p>
            <a
              href="/dashboard/help/faq"
              className="inline-block mt-1 text-xs text-violet-300 hover:text-violet-200 underline"
            >
              {isVi ? 'Xem FAQ về SOPs →' : 'Read SOP FAQ →'}
            </a>
          </div>
        </div>
      )}

      <SopGrid
        templates={templates}
        installedTemplateIds={installedTemplateIds}
        locale={locale}
        installAction={installSopAction}
      />
    </div>
  );
}
