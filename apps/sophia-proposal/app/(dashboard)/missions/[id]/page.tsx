/**
 * Mission Detail Page
 * Server component wrapper — passes mission ID to MissionDetail client component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { MissionDetail } from '@/components/raas/mission-detail';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Mission ${id} | Sophia AI Factory` };
}

export default async function MissionDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/missions"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600 transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          All Missions
        </Link>
      </div>
      <MissionDetail missionId={id} />
    </div>
  );
}
