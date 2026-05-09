/**
 * /dashboard/sops/[id] — SOP Installation detail page.
 *
 * Server Component: fetches installation + template + recent runs.
 * Client tabs: Overview / Runs / Edit / Webhook.
 */

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, getTemplateById } from '@/lib/sop/sop-repo';
import { CategoryBadge } from '@/forest/components/sop/category-badge';
import { SopDetailTabs } from './detail-tabs';
import { runNowAction, savePlaybookAction, regenSecretAction, deleteInstallAction, saveConfigAction } from './actions';
import { ArrowLeft } from 'lucide-react';
import type { SopRunRow } from '@/lib/sop/sop-types';

interface Props {
  params: Promise<{ id: string; locale: string }>;
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

export default async function SopDetailPage({ params }: Props) {
  const { id, locale } = await params;
  const t = await getTranslations('sop');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  if (!db) notFound();

  const installation = await getInstallation(db, id);
  if (!installation || installation.user_id !== user.id) notFound();

  const template = await getTemplateById(db, installation.template_id);

  // Fetch last 20 runs
  const { results: runs } = await db
    .prepare(`SELECT * FROM sop_runs WHERE installation_id = ?1 ORDER BY created_at DESC LIMIT 20`)
    .bind(id)
    .all<SopRunRow>();

  const isVi = locale.startsWith('vi');
  const name = template ? (isVi ? template.name_vi : template.name_en) : id;

  // Resolve playbook (customized or template default)
  const customizations = installation.customizations
    ? (JSON.parse(installation.customizations) as { playbook_md_override?: string })
    : {};
  const playbookMd = customizations.playbook_md_override ?? template?.playbook_md ?? '';

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/dashboard/sops"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('run.backToSops')}
      </Link>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{name}</h1>
            {template && <CategoryBadge category={template.category} />}
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${installation.enabled ? 'bg-emerald-900/50 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
              {installation.enabled ? t('detail_page.enabled') : t('detail_page.disabled')}
            </span>
          </div>
        </div>
      </div>

      {/*
        Pre-bind installationId to each server action so the arrow-wrapper does
        not cross the RSC→Client boundary (Next.js 16 forbids passing non-
        serializable closures). bind() returns a server-action-compatible
        reference because the actions file is `'use server'`.
      */}
      <SopDetailTabs
        installation={installation}
        runs={runs}
        playbookMd={playbookMd}
        installationId={id}
        locale={locale}
        configSchema={template?.config_schema ?? null}
        configDefaults={template?.config_defaults ?? null}
        onRunNow={runNowAction.bind(null, id)}
        onDelete={deleteInstallAction.bind(null, id)}
        onSavePlaybook={savePlaybookAction.bind(null, id)}
        onSaveConfig={saveConfigAction.bind(null, id)}
        onRegenSecret={regenSecretAction.bind(null, id)}
      />
    </div>
  );
}
