/**
 * Mission Detail Page
 *
 * Thin wrapper around MissionDetail component.
 */

import { MissionDetail } from '@/forest/components/raas/mission-detail';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function MissionDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const t = await getTranslations('dashboard.missions');

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/missions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {t('back_to_missions')}
      </Link>

      <MissionDetail missionId={id} />
    </div>
  );
}
