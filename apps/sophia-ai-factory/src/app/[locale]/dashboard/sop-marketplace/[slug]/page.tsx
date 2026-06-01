/**
 * /dashboard/sop-marketplace/[slug] — SOP detail page.
 *
 * Server Component: fetches template by slug.
 * Renders agents preview, playbook preview, output schema, and install modal trigger.
 */

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTemplateBySlug, listInstallationsForUser } from '@/tree/sop/sop-repo';
import { SopPreview } from '@/forest/components/sop/sop-preview';
import { CategoryBadge } from '@/forest/components/sop/category-badge';
import { SopDetailInstallButton } from './install-button';
import { installSopAction } from '../actions';
import { ArrowLeft, Zap } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string; locale: string }>;
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
  const { slug, locale } = await params;
  const t = await getTranslations('sop');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  if (!db) notFound();

  const template = await getTemplateBySlug(db, slug);
  if (!template) notFound();

  const installations = await listInstallationsForUser(db, user.id);
  const alreadyInstalled = installations.some(i => i.template_id === template.id);

  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;
  const description = isVi ? template.description_vi : template.description_en;

  // Pretty-print output schema JSON
  let schemaPretty = template.output_schema;
  try {
    schemaPretty = JSON.stringify(JSON.parse(template.output_schema), null, 2);
  } catch { /* use raw string */ }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/dashboard/sop-marketplace"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('detail.back')}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <CategoryBadge category={template.category} />
          </div>
          <p className="text-muted-foreground mt-2">{description}</p>
          <div className="flex items-center gap-1 mt-2 text-sm text-amber-400">
            <Zap className="w-4 h-4" aria-hidden="true" />
            <span>{template.credits_per_run} credits/run</span>
          </div>
        </div>
        <SopDetailInstallButton
          template={template}
          locale={locale}
          alreadyInstalled={alreadyInstalled}
          installAction={installSopAction}
        />
      </div>

      {/* Agents */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t('detail.agentsTitle')}</h2>
        <pre className="bg-zinc-900 border border-border rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
          {template.agents_yaml}
        </pre>
      </section>

      {/* Playbook */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t('detail.playbookTitle')}</h2>
        <div className="bg-card border border-border rounded-lg p-4">
          <SopPreview content={template.playbook_md} />
        </div>
      </section>

      {/* Output Schema */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t('detail.outputTitle')}</h2>
        <pre className="bg-zinc-900 border border-border rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto">
          {schemaPretty}
        </pre>
      </section>
    </div>
  );
}
