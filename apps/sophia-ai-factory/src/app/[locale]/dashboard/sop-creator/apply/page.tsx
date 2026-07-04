/**
 * /dashboard/sop-creator/apply — "Become a Creator" application page.
 * Non-CEO-friendly bilingual form for requesting creator access.
 */

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { hasCreatorAccess } from '@/land/sop-marketplace';
import { getD1 } from '@/seed/db/get-d1';
import { ApplyForm } from './apply-form';

interface Props { params: Promise<{ locale: string }> }

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('sop.creator.apply');
  return { title: t('pageTitle') };
}

export default async function CreatorApplyPage({ params }: Props) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  if (!db) notFound();

  // Already a creator? Redirect to their dashboard.
  const hasAccess = await hasCreatorAccess(db, user.id);
  if (hasAccess) {
    redirect('/dashboard/sop-creator');
  }

  const t = await getTranslations('sop.creator.apply');

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">{t('heading')}</h1>
        <p className="text-white/60">{t('subtitle')}</p>
      </div>

      {/* Value Proposition Card */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-500/10 to-purple-600/10 border border-primary-500/20 p-6 text-center">
        <div className="text-3xl font-bold text-primary-400 mb-1">{t('valueProp')}</div>
        <p className="text-white/60 text-sm">{t('valuePropDesc')}</p>
      </div>

      {/* Application Form */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <ApplyForm />
      </div>
    </div>
  );
}
