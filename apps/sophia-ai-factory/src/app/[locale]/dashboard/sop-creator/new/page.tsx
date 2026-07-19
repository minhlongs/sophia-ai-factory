/**
 * /dashboard/sop-creator/new — Create a new SOP template.
 * MASTER tier only. Shell is RSC; interactive form is client component.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { hasCreatorAccess } from '@/land/sop-marketplace';
import { Palette, ArrowLeft } from 'lucide-react';
import { SopCreateForm } from './sop-create-form';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { getD1 } from '@/seed/db/get-d1';
import { getTranslations } from 'next-intl/server';

interface Props { params: Promise<{ locale: string }> }

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Create SOP | Sophia AI' };
}

export default async function NewSopPage({ params }: Props) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  if (!db) notFound();

  const hasAccess = await hasCreatorAccess(db, user.id);
  if (!hasAccess) redirect(`/${locale}/pricing`);

  const t = await getTranslations('sop.creator.newSop');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/sop-creator"
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('back')}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/20">
          <Palette className="w-5 h-5 text-primary-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            {t('title')}
          </h1>
          <p className="text-sm text-white/50">
            {t('subtitle')}
          </p>
        </div>
        <RouteHelpTooltip locale={locale} routeKey="sop-creator" />
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <SopCreateForm />
      </div>
    </div>
  );
}
