'use client';

/**
 * InstallationRunsTab — paginated table of sop_runs for an installation.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { SopRunRow } from '@/lib/sop/sop-types';
import { RunStatusBadge } from './run-status-badge';

interface Props {
  runs: SopRunRow[];
  installationId: string;
}

function formatTs(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function durationSec(run: SopRunRow): string {
  if (!run.started_at || !run.completed_at) return '—';
  return `${run.completed_at - run.started_at}s`;
}

function triggerLabel(trigger: SopRunRow['trigger_type'], t: ReturnType<typeof useTranslations>): string {
  const map: Record<string, string> = {
    manual: t('manual'),
    webhook: t('webhook'),
    cron: t('cron'),
  };
  return map[trigger] ?? trigger;
}

export function InstallationRunsTab({ runs, installationId }: Props) {
  const t = useTranslations('sop.run');

  if (runs.length === 0) {
    return <p className="text-muted-foreground text-sm py-8 text-center">{t('noMissions')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card">
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('trigger')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('status')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('started')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('duration')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-muted-foreground">{triggerLabel(run.trigger_type, t)}</td>
              <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
              <td className="px-4 py-3 text-muted-foreground">{formatTs(run.started_at)}</td>
              <td className="px-4 py-3 text-muted-foreground">{durationSec(run)}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/sops/${installationId}/runs/${run.id}`}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {t('viewMission')} →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
