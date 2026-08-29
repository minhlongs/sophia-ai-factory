/**
 * Reality Loop Dashboard — internal product-learning page (Phase J).
 *
 * Admin/owner-gated ONLY — not visible to ordinary customers. Mirrors the
 * creative-economy dashboard for auth + workspace resolution. Bilingual
 * (Vietnamese + English). Every number traces to a performance_events query
 * via getRealityLoopInsights(); missing economic values render as em-dash.
 */

export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getRealityLoopInsights, type RealityLoopInsights } from '@/land/reality-loop/insights';
import { InsightPanels } from './insight-panels';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('realityLoop');
  return { title: t('pageTitle'), description: t('pageDescription') };
}

const ALLOWED_ROLES = ['owner', 'admin'] as const;

export default async function RealityLoopPage() {
  const t = await getTranslations('realityLoop');

  const user = await getCurrentUser();
  if (!user) notFound();

  const d1 = await getD1();
  if (!d1) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('dbUnavailable')}</p>
      </div>
    );
  }

  // Resolve the user's primary workspace + role (mirrors creative-economy).
  const membership = await d1
    .prepare('SELECT org_id, role FROM org_members WHERE user_id = ? ORDER BY created_at ASC LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string; role: string }>();

  if (!membership?.org_id) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-[hsl(240,12%,45%)]">{t('noWorkspace')}</p>
      </div>
    );
  }

  // Gate: owner or admin only.
  if (!ALLOWED_ROLES.includes(membership.role as (typeof ALLOWED_ROLES)[number])) {
    notFound();
  }

  const insights: RealityLoopInsights = await getRealityLoopInsights(membership.org_id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('pageDescription')}</p>
      </header>
      <InsightPanels insights={insights} t={(k, v) => t(k, v)} />
    </div>
  );
}
