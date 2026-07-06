/**
 * CEO Agent 404 — bilingual, links back to parent `/dashboard/ceo-agent`.
 * Server component.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';

export default async function CeoAgentNotFound() {
  const t = await getTranslations('dashboard.ceoAgent');

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 p-8 text-center">
      <div className="p-3 rounded-full bg-muted">
        <span className="text-4xl" aria-hidden="true">
          🤖
        </span>
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-semibold text-foreground">{t('notFoundTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('notFoundDescription')}</p>
      </div>
      <Link
        href="/dashboard/ceo-agent"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t('notFoundBack')}
      </Link>
    </div>
  );
}
