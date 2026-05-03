/**
 * Mission Detail Page
 *
 * Thin wrapper around MissionDetail component.
 */

import { MissionDetail } from '@/forest/components/raas/mission-detail';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function MissionDetailPage({ params }: Props) {
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
