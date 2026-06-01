/**
 * /dashboard/sop-creator/[id] — Creator detail page for a single SOP template.
 *
 * Server Component: fetches template by ID, verifies ownership,
 * shows template details and a "Publish" button for draft templates.
 */

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getTemplateById } from '@/tree/sop/sop-repo';
import { CategoryBadge } from '@/forest/components/sop/category-badge';
import { ArrowLeft, Calendar, Clock, Coins, FileText } from 'lucide-react';
import { CreatorDetailClient } from './creator-detail-client';

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('sop.creator.detail');
  return { title: t('pageTitle', { id }) };
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    archived: 'bg-white/5 text-white/40 border-white/10',
  };
  return map[status] ?? map.draft;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function CreatorDetailPage({ params }: Props) {
  const { id, locale } = await params;
  const t = await getTranslations('sop.creator.detail');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const tier = await getUserTier(user.id);
  if (tier !== 'MASTER') redirect(`/${locale}/pricing`);

  const db = getD1();
  if (!db) notFound();

  const template = await getTemplateById(db, id);
  if (!template || template.author_user_id !== user.id) notFound();

  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;
  const statusLabel = t(template.status as 'draft' | 'published' | 'archived');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/dashboard/sop-creator"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t('back')}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{name}</h1>
            <CategoryBadge category={template.category} />
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border capitalize ${statusBadge(template.status)}`}
            >
              {statusLabel}
            </span>
          </div>
          {/* Show the other language name as subtitle */}
          <p className="text-sm text-white/50 mt-1">
            {isVi ? template.name_en : template.name_vi}
          </p>
        </div>
      </div>

      {/* Template details card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-white/50" aria-hidden="true" />
          <h2 className="text-sm font-medium text-white/80">{t('templateDetails')}</h2>
        </div>

        {/* Descriptions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-white/40 mb-1">{t('descriptionEn')}</p>
            <p className="text-sm text-white/70">{template.description_en || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">{t('descriptionVi')}</p>
            <p className="text-sm text-white/70">{template.description_vi || '—'}</p>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/5">
          <div className="flex items-start gap-2">
            <Coins className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-white/40">{t('creditsPerRun')}</p>
              <p className="text-sm font-medium text-white">{template.credits_per_run}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-white/40">{t('setupTime')}</p>
              <p className="text-sm font-medium text-white">
                {t('setupTimeMinutes', { minutes: template.setup_time_minutes })}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-green-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-white/40">{t('createdAt')}</p>
              <p className="text-sm font-medium text-white">{formatDate(template.created_at)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-white/40">{t('updatedAt')}</p>
              <p className="text-sm font-medium text-white">{formatDate(template.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions — client component handles useTransition */}
      <CreatorDetailClient
        templateId={template.id}
        status={template.status}
      />
    </div>
  );
}
